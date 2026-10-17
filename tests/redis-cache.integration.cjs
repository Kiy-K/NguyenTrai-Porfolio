// Dedicated scratch Redis only. Source callback is synthetic, not a live Neon performance test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Redis } = require('@upstash/redis');
const loadTs = require('./load-ts.cjs');

test('real Upstash cache hits, primary epoch fencing, bounded TTL and cross-instance invalidation', async () => {
  assert.equal(process.env.TEST_REDIS_DISPOSABLE, '1');
  assert.ok(process.env.TEST_REDIS_REST_URL); assert.ok(process.env.TEST_REDIS_REST_TOKEN);
  process.env.UPSTASH_REDIS_REST_URL = process.env.TEST_REDIS_REST_URL;
  process.env.UPSTASH_REDIS_REST_TOKEN = process.env.TEST_REDIS_REST_TOKEN;
  process.env.DATABASE_URL = 'postgresql://synthetic:synthetic@cache-staging.invalid/synthetic';
  delete process.env.APP_DATABASE_URL;
  const a = loadTs('lib/product-cache.ts'), b = loadTs('lib/product-cache.ts');
  const redis = new Redis({ url: process.env.TEST_REDIS_REST_URL, token: process.env.TEST_REDIS_REST_TOKEN, enableAutoPipelining: false });
  const [epoch, payload] = a.productCacheKeys();
  await a.invalidateProductCache();
  let reads = 0, data = [{ id: 'one', images: ['cloudinary/keep'], videos: [{ muxPlaybackId: 'keep' }] }];
  const source = async () => { reads++; return [...data, { id: 'secret-draft', status: 'draft' }]; };
  const started = performance.now(); await a.readPublicProducts(source); const missMs = performance.now() - started;
  assert.equal(reads, 1); assert.ok(await redis.pttl(payload) > 0);
  const hitStart = performance.now(); assert.deepEqual(await b.readPublicProducts(source), data); const hitMs = performance.now() - hitStart;
  assert.equal(reads, 1, 'cache hit must avoid the source query');
  assert.ok(await redis.pttl(payload) <= 60000);
  assert.equal(JSON.stringify(await redis.get(payload)).includes('secret-draft'), false);
  data = [{ id: 'two' }]; await b.invalidateProductCache();
  assert.deepEqual(await a.readPublicProducts(source), data); assert.equal(reads, 2);
  await a.invalidateProductCache();
  let release, entered;
  const inSource = new Promise(resolve => { entered = resolve; });
  const stale = a.readPublicProducts(() => { entered(); return new Promise(resolve => { release = resolve; }); });
  await inSource;
  await b.invalidateProductCache();
  release([{ id: 'old' }]); await stale;
  assert.equal(await redis.get(payload), null, 'old read cannot repopulate after invalidation');
  assert.deepEqual(await b.readPublicProducts(source), data);
  // Accelerate Redis expiration without modifying the application's TTL constant.
  await redis.pexpire(payload, 1); await new Promise(resolve => setTimeout(resolve, 20));
  const beforeExpiry = reads; await a.readPublicProducts(source); assert.equal(reads, beforeExpiry + 1);
  assert.ok(await redis.ttl(epoch) <= 120);
  console.log(JSON.stringify({ synthetic: true, source: 'callback (Neon staging unavailable)', missMs: Math.round(missMs), hitMs: Math.round(hitMs), sourceQueriesOnHit: 0, maxTtlSeconds: 60, crossInstanceFenceVerified: true }));
});
