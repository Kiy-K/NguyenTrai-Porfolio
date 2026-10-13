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

## Runtime database role

The Vercel–Neon integration manages DATABASE_URL (owner role); do not edit it.
At runtime the app prefers APP_DATABASE_URL, a connection URL for the
`portfolio_app` role with only the grants in `scripts/neon-app-role.sql` (no
row removal, truncation or schema changes). Migration tooling keeps using the
owner DATABASE_URL. The build log prints `databaseRole` and the target
fingerprint, never the password. Removing APP_DATABASE_URL and redeploying
returns to the owner role.

## Recovery

Keep peppers, Redis connection settings, and source data unchanged. Before new
Neon writes, selecting Redis and redeploying the compatible release recovers the
untouched source. After new Neon writes, pause writes and reconcile before
switching back, or those new records would be lost. Retain the protected export,
counts/digests, import verification, target fingerprint, and release IDs.
Credential loss or a conflicting/partial destination requires owner recovery;
never delete credential records, reset products, or expose hashes to solve it.

Full dependency audit still reports six high/two moderate findings in development
tooling; production dependency audit passes. CI reports the full audit and blocks
high production dependency vulnerabilities. No force downgrade was performed.
