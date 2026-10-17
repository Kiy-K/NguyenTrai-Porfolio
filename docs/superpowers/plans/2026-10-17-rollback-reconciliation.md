# Rollback reconciliation implementation plan

Goal: prepare an operator-approved, repeatable Neon → Redis recovery without running it in production.

Scope: a standalone `scripts/reconcile-redis.cjs`, `tests/rollback.test.cjs`, synthetic Redis integration coverage, and the recovery section of `docs/neon-migration.md`. Reuse migration digests, pause checks, inventory, and schema verification. No application, AI, environment, or password changes.

- [x] Write regressions first for read-only planning, canonical comparisons, conflicting feedback/IDs/hash fields, unexpected destination changes, partial failures, retries, verification and protected files.
- [x] Export a stable pair of snapshots with target identities. Bind explicit approval to the complete plan digest. Only replace content/credentials matching the exported Redis baseline or desired Neon state; preserve destination-only feedback and all unrelated keys.
- [x] Apply record-level atomic compare-and-set, rechecking source and live pause. Reject extra hash fields rather than deleting them. Stop on failures; retain export and retry only while paused. Verify exact union, IDs/media and credentials after completion.
- [x] Document exact export/review/apply/verify/switch/unpause approvals and partial failure recovery.
- [x] Run lint, typecheck, full synthetic suite, production build and independent review. Publish a separate PR against latest main; stop before merge/deployment.

Review focus: interrupted command response after a successful write; credential field removal; destination-only feedback; unknown persistent keys; backup symlinks/permissions; Lua errors without transactional rollback. Bounded datasets use one CAS per record; no claim of cross-store atomicity. Production remains paused throughout recovery.

PR 2 follows only after PR 1 is reviewable, in a separate branch based on main. Its plan will audit all public/admin readers and cache layers, then test a bounded TTL consistency contract before implementation. Isolated staging validation is a deployment gate.

Validation evidence: `docs/rollback-validation.md`. Independent review completed; empty-hash finding fixed with a failing regression first. All production actions remain unexecuted.
