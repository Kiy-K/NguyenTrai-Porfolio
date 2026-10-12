# Neon persistent-data migration specification

Status: owner approved inline implementation. Real SQL regressions use synthetic data in temporary test schemas; application data has not been imported yet.
Branch: `migration/neon-persistence`, based on merged M0A commit `da757a9`.

## Owner intent and success criteria

The owner authorized a separate phase after M0A to migrate all persistent records,
including administrator credentials, to the existing Neon PostgreSQL database.
The owner approved writing this specification and its implementation plan.
The scope is content, current and legacy feedback, and administrator credential
hashes. Expiring sessions, IP bindings, rate limits, and feedback deduplication
remain in Redis because they are temporary operational state.

Success means the production app reads and writes persistent records in Neon,
existing administrator passwords and sessions still work, product IDs and all
media references are unchanged, and source Redis records remain intact.
Import must be repeatable without replacing different destination data.

## Established facts and unresolved prerequisites

- M0A PR #14 is merged. Its release uses Next.js 16.4.0.
- Production uses Node 24.x; M0A checks passed on Node 24.21.0.
- The configured Upstash connection responds to PING; the administrator
  credential key is a hash with a passwordHash field. No hash value was printed.
- Neon variables exist for Vercel Production/Preview. The local
  `.env.development.local` contains no DATABASE_URL. Exporting production env
  yields a `[SENSITIVE]` placeholder for that value, not a usable connection URL.
- The owner has installed `@neondatabase/serverless@1.2.0` locally. Those edits
  are retained and excluded from M0A.
- The owner configured a usable URL. Read-only checks verified neondb, role neondb_owner, PostgreSQL 18.6, and no public tables. Import additionally pins endpoint/database identity and checks dedicated-schema ownership/structure.

Before executing imports, securely configure DATABASE_URL in a local ignored env
file. Do not paste it into chat or commit it. Verify it identifies the intended
production Neon database, supports TLS, and grants only required schema/data
permissions. Confirm M0A is live before changing persistence.

## Minimal storage design

Use parameterized queries through the installed Neon serverless driver. Preserve
existing JSON shapes rather than introducing a normalized domain model in this
migration. Use a dedicated `portfolio` schema to avoid unrelated Neon Auth or
application tables.

- `portfolio.state`: key TEXT PRIMARY KEY, payload JSONB NOT NULL. Store the
  existing `portfolio_data_v4` object and `admin:credentials:v1` hash object under
  their existing logical keys. No plaintext password is stored.
- `portfolio.feedback`: source_key TEXT PRIMARY KEY, payload JSONB NOT NULL,
  created_at_unix BIGINT NOT NULL. Preserve original feedback keys/fields and
  existing IDs, identity hashes, rating strings, and timestamps. Sort reads by
  timestamp and keep the current admin limit and duplicate-ID behavior.
- Add a timestamp index for newest-feedback reads. Redis search-index metadata
  is implementation state, not a feedback record to copy.

An explicit `PERSISTENCE_BACKEND=postgres` selects Neon; unset selects Redis.
This is a cutover/rollback control, not silent fallback. A selected PostgreSQL
backend failing must produce an error, never read or write a second authority.
Require DATABASE_URL when PostgreSQL is selected.

The storage helper exposes only operations needed by current callers: read/write
content, atomically append a product, read/create/update credentials, and
write/read feedback. Atomic credential insertion must retain M0A's
create-if-absent guarantee. JSONB updates must retain other credential fields.
Atomic SQL append prevents lost concurrent product updates. Redis behavior
remains available until cutover and during a deliberate rollback.

## Application boundaries

Affected callers: `lib/data.ts`, `lib/admin-auth.ts`, product mutation routes,
feedback submit, and admin feedback read. Session helpers and all temporary
Redis operations stay intact. Existing Origin enforcement, authentication,
IP binding, password recheck, rate limits, text sanitization, and HMAC identity
hashing remain at the same trust boundaries. No dashboard refactor is needed.

Add `DATA_WRITE_PAUSED=1` as a temporary mutation guard. It returns 503 with a
clear retry message before content/feedback/credential mutations. During this
window, block bootstrap, product mutations, feedback submit, and login (which
can upgrade legacy credentials). Existing read pages and session-status checks
continue. A shared guard prevents omissions and has regression tests.

Keep cached reads and revalidation contracts. Do not initialize storage during
read operations. A missing content record is an explicit import/configuration
failure after PostgreSQL cutover, not permission to overwrite an empty database.

## Inventory, backup, import, and cutover

1. Inventory Redis keys with cursor-based SCAN and type/TTL checks. Classify all
   persistent keys before deciding none are omitted. Include modern
   `feedback:record:*` and legacy two-segment feedback hashes. Exclude TTL-backed
   session/rate-limit/dedupe state and search metadata. Report unknown persistent
   keys for review instead of silently dropping them.
2. Check source shape, destination schema ownership, and destination conflicts.
   If feedback contains unexpected raw name/class/email fields, stop rather than
   introduce raw-PII storage. Preserve sanitized text and existing identity hashes;
   do not rehash or reinterpret existing records during the copy.
3. Enable the write pause on the Redis-backed release and verify mutation routes
   reject writes. Notify the owner of the brief maintenance window within this
   conversation. Keep all peppers, Redis connection settings, and media env
   variables unchanged.
4. Export a consistent snapshot to a protected file outside Git, permission 0600.
   Include raw stored credential hash fields only in that protected backup.
   Never print data, passwords, hashes, tokens, or connection strings. Record only
   counts and canonical JSON digests in a nonsensitive receipt. Re-read under the
   pause and require the same digest to detect unexpected concurrent changes.
5. Create only the dedicated destination tables/index. Import in one transaction
   with a destination lock. Existing identical rows may be reused; any conflicting
   payload aborts the entire import. Never truncate, delete, reset, or overwrite
   Redis or unrelated Neon data. Verify IDs, payload equality, counts, timestamp
   derivation, and canonical digest after import.
6. Deploy the tested PostgreSQL-capable release with writes still paused, then
   select the PostgreSQL backend. Verify source/destination equality, public
   content, media URLs, admin session status, and owner login without logging
   credentials. Credentials and content must already exist before enabling writes.
7. Disable the write pause only after checks pass. Verify the complete application
   flow using a clearly identified test record or owner-assisted operation, and
   preserve an import/cutover receipt with release IDs and digests.

## Recovery rules

Before new PostgreSQL writes, rollback can select Redis and restore the prior
compatible deployment because the untouched source remains authoritative.
After new PostgreSQL writes, returning to Redis would lose those writes unless
an approved reverse reconciliation is completed. Pause writes and reconcile
from protected backups/receipts first. Do not promise an instant rollback after
cutover activity, and do not invent a public credential-reset endpoint.

No credential rotation, pepper rotation, Redis deletion, media migration, AI
feature changes, or infrastructure provisioning belongs in this phase. A failed
copy leaves Redis serving production under the existing backend.

## Verification and review gates

Run lint, TypeScript, all security regressions, migration regression tests,
production dependency audit, full audit reporting, and a production build on
Node 24. Test SQL operations in an isolated test schema or disposable database,
including atomic provisioning, legacy password verification, transaction rollback
on conflicts, repeat import, and concurrent product append.

The owner approved this written spec/plan for inline execution. Production import still requires verified write pause, matching deployment target fingerprint, protected backup, and conflict-free destination. The connection prerequisite must be satisfied before
integration tests/import. The existing deployment/push approval covers M0A;
the separately requested production migration is governed by this cutover scope.
