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

## Completed isolated application staging

The owner supplied a different Neon endpoint. Read-only identity checks found no
`portfolio` schema/tables; only synthetic application fixtures were created there.
The old production configuration was removed/replaced at the owner's request;
the staging file is ignored and mode 0600. Production `.env.local` was preserved.

Two production-build Next.js instances and a third database-authentication outage
instance ran locally on Node 24.22.0, backed by that dedicated Neon and the
separate disposable Upstash database. The tracked
`tests/cache-app-staging.integration.cjs` passed through actual HTTP routes:

- Public list/detail/section filtering and unchanged IDs/Cloudinary/Mux fields.
- Authenticated fresh reads of all four synthetic records, anonymous 401, and
  no-store API responses. Product/section HTML returned `private, no-cache,
  no-store, max-age=0, must-revalidate`.
- Real authenticated POST and confirmed DELETE, with the other app instance
  observing invalidation. The original synthetic baseline was restored in a
  finally block; credentials/feedback were unchanged.
- A deliberate wrong Redis cache-key type caused a successful direct Neon read.
- An instance with invalid **staging** Neon authentication served the valid warm
  cache (200), then returned 500 after invalidation. No database password changed.
- Final Node 24 run: miss 1762ms, hit 1322ms, remaining Redis TTL 55841ms. These
  are individual remote-development-network samples, not production percentiles.
  The warm hit on the deliberately unavailable database independently confirms
  the cache path avoids a successful Neon read.

Receipt: [redis-cache-staging-receipt.json](redis-cache-staging-receipt.json).
All temporary app servers were stopped; synthetic staging fixtures remain for
inspection. Production data, passwords, environments and deployments were untouched.

To reproduce, start two copies of the built app with the same dedicated staging
Neon/Redis and a known synthetic `ADMIN_AUTH_PEPPER`. Seed exactly the four
synthetic IDs used by the test (`cache-stage-public`, `cache-stage-legacy`,
`cache-stage-draft`, `cache-stage-archive`) with published/missing/draft/archived
statuses; include both legacy video and Mux references on the public product.
A third copy uses invalid **staging connection authentication** at the same
endpoint, with the same Redis. Supply only explicit test configuration:
`TEST_ISOLATED_STAGING=1`, `TEST_REDIS_DISPOSABLE=1`, `TEST_REDIS_REST_URL`,
`TEST_REDIS_REST_TOKEN`, `STAGING_DATABASE_URL`, `STAGING_EXPECTED_NEON_HOST`,
`STAGING_APP_URL_A`, `STAGING_APP_URL_B`, `STAGING_NEON_OUTAGE_APP_URL`,
`STAGING_AUTH_PEPPER`, and optional `STAGING_RECEIPT_PATH`, then run
`node tests/cache-app-staging.integration.cjs`. The script never auto-loads local
production credentials, rejects the known production target, requires a pinned
staging hostname and exact synthetic ID set, and restores the synthetic baseline.

The first launcher attempt was rejected by the assertions because Next.js reset
in-process environment injection. Restarting a child process with explicit env
inheritance fixed the **test launcher**; no product code was changed. Local
mutation requests used Next's canonical `localhost` Origin. Failed staging runs
were not counted as passing evidence.

## Vercel CDN and deployment gate

The isolated application staging gate above is complete. Actual Vercel CDN
`x-vercel-cache` behavior was **not** measured: no Vercel deployment was made.
The cache audit found no product `CDN-Cache-Control` or
`Vercel-CDN-Cache-Control` override in application/config source. The unrelated
preview API's CDN cache is preserved. Vercel documents that targeted CDN headers
have precedence over Cache-Control; see [Vercel cache-control rules](https://vercel.com/docs/caching/cache-control-headers).
The product APIs explicitly send no-store and dynamic HTML sends private/no-store.
Keep the PR draft until the isolated Vercel preview/header receipt and owner
release review are complete. No production deployment is proposed.

For a later isolated Vercel preview, retain these verification steps:

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
