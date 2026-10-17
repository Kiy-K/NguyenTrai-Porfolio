# Redis public cache validation — 2026-10-17

Base: `a97c5ddc79c848e64938f56efaba55e6abce83e6` (main, independent of rollback PR #26).

## Audit and implemented contract

The old read path combined `unstable_cache(1800)`, page `revalidate=1800`, and
mutation `revalidatePath('/', 'layout')`; product APIs had no explicit cache
headers. Public reads now have one application cache in Redis. Product/section
routes are dynamic, API success/error responses are no-store, and Next data-cache
wrapping/path invalidation are removed. Homepage ISR has no product data and is
unchanged. Image optimization and already-rendered browser state are separate;
long-open tabs still refresh through the existing AutoReloader.

The public cache holds product lists only. Missing legacy status and `published`
are public; drafts/archives/unknown statuses are excluded before storage. Every
successful Neon content mutation invalidates through a shared epoch. Lua scripts
on the Redis write path coordinate all instances, so correctness does not depend
on one SDK client's read-your-writes token. Late fills compare the epoch and use
an absolute Redis-clock read-start deadline, with at most 60 seconds total life.
If invalidation fails, that same 60-second bound applies. In-flight source reads
may return their earlier snapshot. Fresh admin reads bypass the cache. No Neon
error is replaced with an empty list or the persistent Redis content snapshot.

## Completed evidence

- Test-first cache regressions failed on missing implementation; API regressions
  reproduced missing no-store, missing authenticated fresh reads, redundant Next
  caching and absent mutation invalidation before changes.
- Independent review found no blocking correctness/privacy/concurrency bugs.
  Its constructor-failure hardening suggestion was reproduced with a failing
  regression and fixed; fill failures also retain the source response.
- Node 24.22.0: 57 regressions, lint, typecheck and Webpack production build pass.
  The build confirms product/section/API routes dynamic and homepage static.
  Credential-free builds emit expected missing-provider warnings. This machine
  blocks Turbopack's CSS-worker port binding, so Webpack is the production build
  check; no bundler configuration change is included.
- Real disposable Upstash integration passed the actual SDK/Lua scripts with
  two independently constructed module/client instances: miss, hit (zero source
  queries), expiry, invalidation, old-read fencing, draft exclusion and TTL checks.
- Measured over this development network: miss 610ms, hit 309ms, total integration
  7.6s. The source was a synthetic callback, so these numbers do **not** establish
  Neon/application throughput or a production latency improvement. The initial
  800ms timeout failed the remote test; the 2000ms/no-retry configuration passed.
  A cache outage can add at most one 2s read attempt before the direct source read;
  a fill/invalidation can add one separate 2s attempt. Session clients are unchanged.
- Deterministic clock tests cover exact expiry, late fills after failed
  invalidation, epoch expiry, independent-instance behavior, Redis read/fill/setup
  failures, Neon outages, and source-scoped namespaces. API tests cover admin
  authentication, uncached drafts and no-store failures. Persistence tests assert
  invalidation only after successful updates.

Reproduce Redis integration with dedicated `TEST_REDIS_REST_URL`,
`TEST_REDIS_REST_TOKEN`, `TEST_REDIS_DISPOSABLE=1`:

```bash
node --test tests/redis-cache.integration.cjs
```

Do not set these to application Redis. The test leaves only TTL-bound cache keys
under a synthetic database namespace. No flush or persistent-record deletion.

## Full application staging gate

Pending dedicated staging Neon configuration and an isolated app origin. Existing
local `.env.local` Redis matches the historical production target and was never
used. The old `.env.development.local` was removed at the owner's request so it
can be replaced with staging configuration; secrets stay outside commits/logs.
The PR remains a draft until the full gate has evidence. No production deployment
is proposed by this report.

With an isolated Neon branch/database, dedicated Redis and a staging deployment:

1. Privately verify all three target identities differ from production. Pin the
   exact release commit. Keep production env/auth settings unchanged. Use only
   synthetic products and synthetic session/credential/feedback fixtures. Record
   staging provenance and endpoint fingerprints without secrets.
2. Run the production build on Node 24, deploy only to isolated staging, and
   verify product/section/API Cache-Control plus Vercel `x-vercel-cache` behavior.
   Repeated API reads should not be cached at the CDN. Public product routes
   should be dynamic in the build manifest; the homepage may remain static.
3. Seed/read a synthetic published product, draft and archive, with both legacy
   video and Mux references. Verify only published/legacy-public products appear
   in list/detail/section responses and the actual Redis payload. Credentials
   and feedback must not appear. Compare all retained IDs/media fields.
4. Observe a miss and repeated hits from at least two app instances/regions;
   record HTTP latency, Neon query count and Redis TTL. Hits must avoid Neon
   reads. Do not infer speed from the synthetic callback timings above.
5. Use authenticated POST and confirmed DELETE on synthetic content. Verify
   successful Neon writes invalidate across instances, authenticated
   `GET /api/products?fresh=1` reads fresh private/admin content with no-store,
   and anonymous fresh requests return 401.
6. Hold a pre-write source read, commit a mutation, release it and verify its
   old data cannot refill after invalidation. Inject an invalidation failure;
   verify TTL never extends beyond the original read-start +60s. In-flight
   responses can return their earlier snapshot; subsequent cache fills obey the
   deadline. Record the expected bounded stale window explicitly.
7. Inject Redis-only read/fill/invalidation failures in staging: reads reach Neon,
   already committed mutations remain successful. Inject a Neon failure on a
   cold/expired cache: APIs must return an error, never a fake empty dataset.
   A still-valid public hit may serve until expiry. Restore staging connectivity.
8. Attach nonsensitive staging receipts and get approval before marking ready,
   merging or proposing a production deployment. No production rollout, Redis
   source deletion, credential reset or database migration is part of this PR.
