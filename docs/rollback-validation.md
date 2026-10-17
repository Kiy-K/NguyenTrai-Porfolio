# Rollback reconciliation validation — 2026-10-17

Base: `a97c5ddc79c848e64938f56efaba55e6abce83e6` (latest main at start).
No production calls, environment changes, data copies or rollback executions.

- Regression tests written before implementation; absent module failed first.
- Independent reviewer identified unrepresentable empty feedback hashes; its
  regression failed, then passed after planning rejected them before writes.
- Node 24.22.0: `npm test` — 54 tests passed; `npm run lint` and
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

- After dedicated staging was supplied, the actual CLI `dry-run` also passed
  against a confirmed-empty staging Neon seeded only with synthetic fixtures and
  the separate scratch Redis. It exported four Neon products versus two Redis
  products, planned three changes, retained a three-row feedback union and wrote
  an exclusive 0600 plan under an operator-owned 0700 `/var/tmp` directory.
  The dry-run itself performed no Redis/Neon writes; fixture seeding was separate.
  Source/schema identity and canonical comparison
  used the real provider SDKs. The synthetic private backup remains outside Git.

Untested: a full recovery rehearsal against a dedicated Neon clone, production
search-index readiness, owner login, environment switch and deployment. Those
remain operator approval/verification gates in `neon-migration.md`. Synthetic
SQL-boundary tests check read-only repeatable-read exports; no production Neon
schema was created for this PR. Preserve protected backups and live pause until
all final recovery checks pass.

## Review fixes — 2026-10-17

- Shared final verification now checks the live pause before and after the Neon/
  Redis reads in both apply and standalone verify. Missing/invalid origins fail
  before provider I/O or export. The CLI regression executes the actual command
  with fake provider boundaries and proves it cannot report success with an
  absent pause or a pause lifted during the reads.
- New regressions failed before implementation: apply accepted a pause lifted
  during its final read; planning accepted a missing origin. Guard and CLI tests
  now pass, including destination-only feedback equality and exact failure modes.
- Disposable integration setup rejects the application Redis endpoint and any
  nonempty database before writes. Its full fixture and sentinel clean up in
  finally blocks. Unit checks cover misconfiguration and failed assertions.
- Node 24.22.0: 64 tests, lint, typecheck and Webpack production build passed.
  Independent review of these fixes found no material issues.
- The real SDK/Lua integration passed against a new, exclusively assigned empty
  temporary Upstash database: 50.5s total, 34.1s measured reconciliation/verification
  portion. Cleanup and a separate read-only DBSIZE check both confirmed zero
  remaining keys. No application Redis/Neon, passwords, environments or deployment
  settings were changed. No production rollback, merge or deployment was run.
