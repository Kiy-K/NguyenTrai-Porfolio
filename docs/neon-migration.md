# Neon migration operations

## Storage and scope

`PERSISTENCE_BACKEND=postgres` selects Neon for content, hashed feedback, and
credential hashes. Unset/redis selects the original Redis store. No automatic
fallback exists. Redis remains required for expiring sessions/IP bindings, rate
limits, and feedback deduplication. Cloudinary/Mux references and product IDs are
copied unchanged.

Dedicated tables are `portfolio.state` (the existing content and credential
payloads under their logical keys) and `portfolio.feedback` (source keys, full
hashed/sanitized payloads, timestamp index). Unknown permanent source keys abort
inventory; only known `feedback_idx_v1` search metadata is excluded. Both modern
and legacy feedback hashes are included.

## Verification before deployment

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:neon`, both full
and production dependency audits, and `npm run build` on Node 24. The optional
Neon test uses an independently named synthetic schema, validates transactional
rollback/idempotence and real storage operations, and removes only its own test
schema. It never touches Redis or the application tables.

Store DATABASE_URL securely in an ignored local env file. Exported Vercel
sensitive variables may contain `[SENSITIVE]`, which is not a usable connection
URL. The build logs an endpoint/database fingerprint without credentials; pooled
and direct transport URLs normalize to the same endpoint identity. Compare the
production deployment fingerprint to `node scripts/migrate-neon.cjs identity`
before import. Pin the exact expected host/database in the import command.
Vercel production builds with PERSISTENCE_BACKEND=postgres fail unless
APP_DATABASE_URL is set to a non-owner role on the same endpoint/database as
DATABASE_URL (both required); the failed build leaves the
current deployment serving. To run as the owner again, instantly roll back to
an earlier deployment rather than removing APP_DATABASE_URL.
Existing dedicated schema objects must have the current database role as owner,
the expected table/primary-key structure, and no unknown objects/functions/triggers.

## Paused export/import procedure

Use the canonical production origin as MIGRATION_APP_URL. The tool verifies a
503 response with the live X-Data-Write-Paused marker; a local flag alone is not
enough. Product mutations, feedback submit, bootstrap, and login are paused.
Legacy password checks from feedback read defer upgrades during the pause.

1. Deploy the PostgreSQL-capable code while Redis remains selected and set
   DATA_WRITE_PAUSED=1 for that production release. Verify the pause marker,
   allowing existing requests to settle. Do not use historical deployment URLs
   or other Redis writers during this operation.
2. Inventory with `node scripts/migrate-neon.cjs inventory`.
3. Export to an operator-owned private directory outside every Git repository:

   ```bash
   DATA_WRITE_PAUSED=1 MIGRATION_APP_URL=https://nguyen-trai-porfolio.vercel.app \
     node scripts/migrate-neon.cjs export /absolute/private/production.json
   ```

   The directory must be 0700 and the file is created exclusively with 0600.
   Symlinks into a repository are rejected. Two source reads must have identical
   canonical digests. Never print the backup: it contains credential hashes.
4. Compare the local and production target fingerprints, then import:

   ```bash
   DATA_WRITE_PAUSED=1 MIGRATION_APP_URL=https://nguyen-trai-porfolio.vercel.app \
     node scripts/migrate-neon.cjs import /absolute/private/production.json expected-neon-host/neondb
   ```

   Source host/digest must still match. A destination lock and one transaction
   reject any conflicting or extra destination records and insert only missing
   identical-source records. No source delete or destination truncate is used.
5. Verify with `node scripts/migrate-neon.cjs verify /absolute/private/production.json expected-neon-host/neondb`.
   Recheck the paused source digest before switching, then set
   PERSISTENCE_BACKEND=postgres and deploy while still paused.
6. Verify the deployed product payload, all media references, persisted credential
   hash equality, and existing sessions. Remove the pause only after these pass.
   Login is itself paused because it can upgrade credentials: owner login is
   checked immediately after unpausing. A clearly identified synthetic feedback
   record may verify the write/read path; record its UUID in the receipt.

## Production status

Production has served from Neon (`PERSISTENCE_BACKEND=postgres`, writes
unpaused) since 2026-10-13; receipts are in the
[execution ledger](superpowers/plans/2026-10-12-neon-persistence-ledger.md).
New Neon writes have happened (credential reset, feedback), so rollback to Redis
now requires the reconcile step below.

Vercel functions have no static egress IPs, so an Upstash IP allowlist blocks
them: admin login then fails with `500 UpstashError` before the password is
checked (a wrong password returns 500 instead of 401). Keep the Upstash
database reachable from Vercel; sessions and rate limits always need Redis.

## Runtime database role

The Vercel–Neon integration manages DATABASE_URL (owner role); do not edit it.
At runtime the app prefers APP_DATABASE_URL, a connection URL for the
`portfolio_app` role with only the grants in `scripts/neon-app-role.sql` (no
row removal, truncation or schema changes). Migration tooling keeps using the
owner DATABASE_URL. The build log prints `databaseRole` and the target
fingerprint, never the password. Instantly rolling back to an earlier
deployment built without it (for example `dpl_7HagW3y4…`) returns to the owner
role.

To rotate the credential without breaking running deployments, stage it:
create a replacement login role (for example `portfolio_app_v2`) with the same
grants from `scripts/neon-app-role.sql`, point APP_DATABASE_URL at it, redeploy
and verify. Only then disable the old role (`ALTER ROLE portfolio_app NOLOGIN`).
Changing the live role's password in place breaks every running deployment
until the replacement is promoted. Deployments built with the old role can no
longer serve after it is disabled, so pick a new instant-rollback target.

## Point-in-time restore

The Neon store (`school-nguyentrai`, Vercel marketplace) is on the Free plan.
Neon documents its restore window as at most 6 hours, capped at 1 GB of
changes (paid plans: up to 7 or 30 days). The project's exact
`history_retention_seconds` needs a Neon API key or the Neon console (project
settings, instant restore); it was not read. Treat PITR as an undo for the last
few hours only, not as a backup: the protected export and the untouched Redis
source are the durable recovery points.

## Recovery

Keep peppers, Redis connection settings, and source data unchanged. Before new
Neon writes, selecting Redis and redeploying the compatible release recovers the
untouched source. After new Neon writes, pause writes and reconcile before
switching back, or those new records would be lost. Retain the protected export,
counts/digests, import verification, target fingerprint, and release IDs.
Credential loss or a conflicting/partial destination requires owner recovery;
never delete credential records, reset products, or expose hashes to solve it.

### Rollback reconciliation (Neon → Redis)

No reconcile tool exists yet; build and test it before it is needed. The
existing tooling only reads Redis and writes Neon. Requirements:

1. Set DATA_WRITE_PAUSED=1 and verify the live pause marker, as for the
   original export. Neon is the source of truth until the switch.
2. Write a protected export of the Neon state (content, credential record,
   all feedback) outside Git (0700/0600), with counts and a canonical digest.
   Two reads must match.
3. Compare with Redis and copy only what differs. Never delete Redis keys or
   overwrite anything that is not a Neon record:
   - `admin:credentials:v1`: write the Neon hash fields. The Redis hash is
     stale since the 2026-10-13 password reset; the old hash stays in the
     2026-10-12 protected backup.
   - `feedback:record:<id>`: add each Neon feedback row missing from Redis,
     with the payload as hash string fields. Existing Redis feedback is kept.
   - `portfolio_data_v4`: write the Neon content only if it differs
     canonically (jsonb reorders keys; compare canonical digests).
   - Leave `feedback_idx_v1`, sessions, rate limits and dedupe keys alone.
4. Re-read Redis and confirm canonical equality with the Neon export: counts,
   credential hash, every feedback payload, content digest, media references.
5. Set PERSISTENCE_BACKEND=redis, deploy while paused, verify, then unpause.
   Owner login checks the copied credential.

Records that exist only in Neon as of 2026-10-13: the reset credential hash and
two synthetic feedback records (`16c6a75b-…`, `a556b80b-…`). Content is still
equal to the 2026-10-12 backup.

Full dependency audit still reports six high/two moderate findings in development
tooling; production dependency audit passes. CI reports the full audit and blocks
high production dependency vulnerabilities. No force downgrade was performed.
