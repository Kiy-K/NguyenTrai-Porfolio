# Redis public product cache implementation plan

Goal: Neon owns persistent content; Redis caches public product lists and retains sessions/rate limits/dedupe. PR is independent of rollback PR #26 and based on `a97c5dd` main.

Scope: new `lib/product-cache.ts`, `lib/data.ts`, successful Neon content mutations in `lib/persistence.ts`, public product APIs, product/section page cache configuration, relevant tests and storage/API/operations docs. Preserve media/IDs and legacy operator-selected rollback backend. No AI route changes.

- [x] Write regressions first: hits/misses/TTL, draft/archive exclusion, read/fill/invalidation outages, DB errors, source-scoped namespaces, concurrent readers/writers across instances, expiry during a slow read, fresh authenticated admin reads, post-success mutation invalidation.
- [x] Implement 60-second cache using Redis TIME deadlines and primary Lua scripts: atomic epoch+payload read, compare-epoch publication with remaining TTL, atomic epoch replacement+payload delete. Epoch lives 120 seconds and uses random UUIDs, avoiding expiry ABA. Redis cache calls have 2000ms timeout and no retries. Neon errors propagate; Redis errors read source.
- [x] Filter public products before storage/return (undefined legacy status and published only). Private credentials/feedback never enter the cache. Fresh authenticated `GET /api/products?fresh=1` bypasses it. Disable product/section Full Route Cache and return no-store API responses; remove unstable_cache and redundant path revalidation.
- [x] Test real Upstash Lua and multiple clients in disposable staging. Record source-read counts/latencies and bounded-consistency evidence. A full app staging rehearsal requires an independently configured Neon clone and isolated deployment; never use local production URLs for mutation checks.
- [x] Run lint/typecheck/tests/production build on Node 24, obtain independent review, create draft PR if the full staging gate remains unavailable. Stop before merge/production deployment.

Consistency contract: successful invalidation prevents old in-flight reads from refilling. If invalidation fails, cached responses are bounded to 60 seconds from the original source read's Redis-clock start, including late fills. Already-running requests may return their earlier source snapshot. Admin reads bypass cache. All Redis operations use Lua (including a generation SET on read) so cross-instance fencing occurs on the Redis write path; no process-local cache or client session read-your-writes assumption.

Audit: old lib/data.ts has unstable_cache(1800), pages declare revalidate=1800, mutations call revalidatePath(layout). No explicit API cache headers. Homepage contains no product data and may remain static. Client Router Cache may retain already-rendered navigations; active pages do not auto-refresh on another admin's writes. HTTP/new server reads follow the cache contract.

Validation ruling: the initial 800ms cache timeout failed real Upstash staging over this network. Use a bounded 2000ms timeout with no retries, then rerun the unchanged integration assertions. This trades a longer cache-outage delay for reliable remote operation; actual Neon/app staging latency still needs measurement.

Independent review: no blockers. Constructor failures now fall back safely after a failing regression. Node 24 local gates pass (57 tests). Real Redis integration passes; full Neon/app staging awaits owner configuration. Evidence: `docs/redis-cache-validation.md`.

Staging completion: dedicated empty Neon + scratch Upstash + two real HTTP app instances and one deliberate database-auth outage instance passed on Node 24.22.0; baseline restored, servers stopped. Tracked reproducer and nonsensitive receipt added. Vercel CDN preview/header verification remains a pre-deployment gate; PR stays draft.
