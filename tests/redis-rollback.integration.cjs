// Run only against a dedicated disposable database, never application Redis.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Redis } = require('@upstash/redis');
const { collectSnapshot, payloadDigest } = require('../scripts/migrate-neon.cjs');
const { createPlan, reconcile, redisCas, rawAdapter, normalize, CAS } = require('../scripts/reconcile-redis.cjs');

test('real Upstash reconciliation preserves sessions and verifies CAS, retries and wire hashes', async () => {
  assert.equal(process.env.TEST_REDIS_DISPOSABLE, '1', 'Explicit disposable database acknowledgement required');
  assert.ok(process.env.TEST_REDIS_REST_URL); assert.ok(process.env.TEST_REDIS_REST_TOKEN);
  const options = { url: process.env.TEST_REDIS_REST_URL, token: process.env.TEST_REDIS_REST_TOKEN, enableAutoPipelining: false };
  const redis = new Redis(options), raw = new Redis({ ...options, automaticDeserialization: false });
  // These are synthetic canonical application keys in this dedicated database only.
  const initial = { version: 1, content: { products: [{ id: 'one', images: ['cloudinary/keep'], videos: [{ muxPlaybackId: 'keep' }] }] }, credentials: { passwordHash: 'a'.repeat(64), createdAt: 'original' }, feedback: [{ sourceKey: 'feedback:record:one', payload: { id: 'one', createdAtUnix: '123', text: 'synthetic' } }] };
  await redis.set('portfolio_data_v4', initial.content);
  await redis.hset('admin:credentials:v1', initial.credentials);
  await redis.hset(initial.feedback[0].sourceKey, initial.feedback[0].payload);
  await redis.set('admin:session:synthetic', 'preserved', { ex: 3600 });
  await redis.set('feedback:dedupe:synthetic', 'preserved', { ex: 3600 });
  const source = structuredClone(initial); source.credentials.passwordHash = 'b'.repeat(64);
  source.content.products.push({ id: 'two', video: 'legacy/unchanged' });
  source.feedback.push({ sourceKey: 'feedback:record:two', payload: { id: 'two', createdAtUnix: '124', text: 'synthetic' } });
  const readRedis = async () => normalize(await collectSnapshot(rawAdapter(raw)));
  const baseline = await readRedis();
  // Re-runs start from either this synthetic baseline or its already reconciled state.
  const plan = createPlan(source, baseline, { neon: 'synthetic', redis: new URL(options.url).hostname, origin: 'https://synthetic.invalid' });
  let writes = 0;
  const config = { plan, readRedis, readNeon: async () => source, verifyPause: async () => {}, apply: true, approval: plan.approval,
    cas: async record => { await redisCas(raw, record); if (++writes === 1) throw Error('synthetic lost response'); } };
  if ((await reconcile({ ...config, apply: false })).pending) await assert.rejects(reconcile(config), /lost response/);
  const start = performance.now();
  const result = await reconcile({ ...config, cas: record => redisCas(raw, record) });
  assert.equal(result.verified, true);
  assert.equal(payloadDigest(await readRedis()), payloadDigest(normalize(source)));
  assert.equal((await reconcile(config)).applied, 0);
  assert.equal(await redis.get('admin:session:synthetic'), 'preserved');
  assert.equal(await redis.get('feedback:dedupe:synthetic'), 'preserved');
  assert.ok(await redis.ttl('admin:session:synthetic') > 0);
  const credentialBefore = await rawAdapter(raw).hgetall('admin:credentials:v1');
  await redis.hset('admin:credentials:v1', { createdAt: 'concurrent' });
  assert.equal(await raw.eval(CAS, ['admin:credentials:v1'], ['hash', JSON.stringify(credentialBefore), JSON.stringify(source.credentials)]), 0);
  assert.equal((await rawAdapter(raw).hgetall('admin:credentials:v1')).createdAt, 'concurrent');
  await redis.hset('admin:credentials:v1', source.credentials);
  assert.equal(await raw.eval(CAS, ['admin:session:synthetic'], ['hash', '{}', '{"field":"value"}']), 0);
  await redis.hset('feedback:record:ttl-synthetic', { id: 'ttl-synthetic' });
  await redis.expire('feedback:record:ttl-synthetic', 3600);
  assert.equal(await raw.eval(CAS, ['feedback:record:ttl-synthetic'], ['hash', '{"id":"ttl-synthetic"}', '{"id":"changed"}']), 0);
  assert.equal((await rawAdapter(raw).hgetall('feedback:record:ttl-synthetic')).id, 'ttl-synthetic');
  const expected = await raw.get('portfolio_data_v4');
  await redis.set('portfolio_data_v4', { products: [] });
  assert.equal(await raw.eval(CAS, ['portfolio_data_v4'], ['string', JSON.stringify(expected), JSON.stringify(expected)]), 0);
  assert.deepEqual(await redis.get('portfolio_data_v4'), { products: [] });
  await redis.set('portfolio_data_v4', source.content);
  await redis.set('unknown:synthetic', 'block');
  await assert.rejects(readRedis(), /unknown persistent/i);
  // Only this explicitly synthetic sentinel is removed; application records and transient keys remain.
  await redis.del('unknown:synthetic');
  console.log(JSON.stringify({ synthetic: true, verified: true, durationMs: Math.round(performance.now() - start), target: new URL(options.url).hostname }));
});
