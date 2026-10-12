# Neon persistent-data migration implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move persistent content, feedback, and credential hashes to Neon without losing admin access or deleting Redis source data.

**Architecture:** Preserve the current payloads in dedicated PostgreSQL JSONB tables. Introduce only the storage operations current callers need, keep temporary state in Redis, and perform a paused-write, verified transactional import before explicit backend cutover.

**Tech Stack:** Next.js 16.4+, TypeScript, Node 24, @neondatabase/serverless 1.2.0, Upstash Redis, native Node test runner.

**Spec:** [Migration specification](../specs/2026-10-12-neon-persistence.md)

## Global constraints

- PERSISTENCE_BACKEND=postgres selects Neon; unset selects Redis. No silent fallback.
- DATA_WRITE_PAUSED=1 blocks persistent mutations during cutover.
- Preserve passwords, credential schemes, timestamps, product IDs, media references, and identity hashes.
- Keep TTL-backed sessions/rate limits/dedupe state in Redis.
- No source deletion, destination truncation, credential/pepper rotation, or unrelated schema writes.
- Credentials and snapshot contents stay in protected files outside Git and logs.
- Preserve all unrelated working-tree changes, including Next typings and owner Neon setup.

## Review focus

Unknown permanent Redis keys; existing Neon schema conflicts; legacy feedback
with unexpected raw identity fields; concurrent credential upgrades during export;
rollback after new Neon writes. Each requires explicit handling, not optimistic
assumptions.

## Task 1: Prerequisites and regression fixtures

Files: `.env.example`, `package.json`, `package-lock.json`, `tests/migration.test.cjs`, `tests/load-ts.cjs` only if its mock boundary needs extension.

- [ ] Obtain a usable DATABASE_URL in an ignored local file; verify destination identity and schema read-only. Never use `[SENSITIVE]` as a credential.
- [ ] Confirm M0A deployment version/commit and retain its release URL.
- [ ] Incorporate the owner's Neon dependency into this phase with a lockfile consistent with M0A security updates; retain original pending diffs.
- [ ] Write failing tests for backend selection, required PostgreSQL config, write pause, original payload preservation, and atomic create-if-absent.
- [ ] Run tests and confirm each fails for the intended missing behavior.

## Task 2: Persistent storage and application callers

Files: `lib/persistence.ts`, `lib/data.ts`, `lib/admin-auth.ts`, `lib/request-security.ts`, `app/api/products/route.ts`, `app/api/feedback/route.ts`, `app/api/admin/feedback/read/route.ts`, `app/api/admin/auth/{bootstrap,login}/route.ts`.

- [ ] Add a lazy Neon client and parameterized operations for the two state keys and feedback records. Avoid connecting when Redis remains selected.
- [ ] Implement atomic credential insert and product append. Keep existing hashing and legacy verification paths.
- [ ] Add the shared write-pause guard; update all persistent mutation boundaries and preserve existing auth/Origin/rate-limit checks.
- [ ] Route persistent reads/writes through the helper; retain Redis session, IP, rate-limit, and dedupe calls.
- [ ] Use newest-feedback SQL reads with bounded limits and preserved duplicate-ID semantics. Stop invoking RediSearch for PostgreSQL-backed feedback.
- [ ] Keep public response shapes, product/media fields, cache tags, and revalidation unchanged.
- [ ] Run security and migration tests, lint, TypeScript checks, dependency audits, and build. Confirm selected-backend failure never writes to another backend.
- [ ] Commit only reviewed code and config on migration/neon-persistence.

## Task 3: Backup and verified import tooling

Files: `scripts/migrate-neon.cjs`, `scripts/neon-schema.sql`, `tests/migration.test.cjs`, `docs/operations.md`, `docs/security-m0a.md`, `.gitignore` only for a protected-backup exclusion if needed.

- [ ] Write failing tests for SCAN pagination, modern/legacy records, TTL exclusions, unknown permanent keys, raw-PII rejection, stable digests, malformed content, and destination conflicts.
- [ ] Implement explicit inventory/export/verify/import commands. No command auto-deploys, clears Redis, or silently overwrites existing destination rows.
- [ ] Create the dedicated portfolio schema/tables/index only after target verification.
- [ ] Implement a destination-locked transaction that aborts completely on any conflicting payload and supports identical repeat imports.
- [ ] Test against isolated PostgreSQL fixtures: rollback, idempotence, atomic provisioning, and concurrent append. Clean up only test-owned schema objects.
- [ ] Document source inventory, backup location/permissions, counts/digests, failure behavior, and post-cutover rollback limits.
- [ ] Re-run full local verification; commit tooling/docs.

## Task 4: Production cutover and evidence

Files: release receipts and nonsensitive operations documentation; production changes only within the approved migration scope.

- [ ] Publish the migration PR and wait for security CI/build checks. Verify the exact tested artifact.
- [ ] Announce the maintenance window; deploy PostgreSQL-capable code while Redis remains selected and enable DATA_WRITE_PAUSED=1.
- [ ] Verify persistent mutation routes return 503; inventory and export protected production snapshots; require matching repeat digests.
- [ ] Import into the verified Neon target transactionally and verify every persistent payload/count/ID and credential hash equality without printing values.
- [ ] Select PostgreSQL while still paused; deploy and verify content, media references, admin access, and existing sessions.
- [ ] Remove the write pause after successful checks and verify an owner-assisted write/read flow.
- [ ] Record release IDs, aggregate verification counts/digests, residual risks, and rollback prerequisites. Leave all Redis source records intact.

Execution is pending review of this spec/plan and the usable local Neon connection
prerequisite. No production data import has been run.
