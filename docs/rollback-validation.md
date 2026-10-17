# Rollback reconciliation validation — 2026-10-17

Base: `a97c5ddc79c848e64938f56efaba55e6abce83e6` (latest main at start).
No production calls, environment changes, data copies or rollback executions.

- Regression tests written before implementation; absent module failed first.
- Independent reviewer identified unrepresentable empty feedback hashes; its
  regression failed, then passed after planning rejected them before writes.
- Node 24.22.0: `npm test` — 54 assertions passed; `npm run lint` and
  `npm run typecheck` passed; `npm run build -- --webpack` passed.
- Default Turbopack build fails in this environment when its CSS worker tries
  to bind an internal port (`Operation not permitted`). Webpack production
  compilation, type checking, prerendering and trace collection completed.
  Builds were credential-free; expected missing-provider warnings were emitted.
- `node --test tests/redis-rollback.integration.cjs` against a separately
  provisioned, temporary Upstash database passed. It exercised the real SDK,
  Lua string/hash CAS, credential replacement, missing feedback insertion,
  session/dedupe preservation, wrong types, TTL collisions, conflicting writes,
  unknown permanent records, lost-response retry, final digest verification and
  repeated application. No flush or application database was used.
- Final real Redis run: 50.8 seconds total; measured retry/verification/CAS
  portion 34.2 seconds. This is an integration correctness measurement over
  remote HTTP, **not** a production throughput claim. Runtime scales with the
  number of changed records and repeated source/pause checks. The deliberate
  per-record checks favor recovery safety; writes stay paused throughout.

Untested: a full recovery rehearsal against a dedicated Neon clone, production
search-index readiness, owner login, environment switch and deployment. Those
remain operator approval/verification gates in `neon-migration.md`. Synthetic
SQL-boundary tests check read-only repeatable-read exports; no production Neon
schema was created for this PR. Preserve protected backups and live pause until
all final recovery checks pass.
