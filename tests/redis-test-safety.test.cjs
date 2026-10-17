const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requireEmptyDisposableRedis, withSyntheticSentinel } = require('./redis-test-safety.cjs');
const fixture = () => ({ TEST_REDIS_DISPOSABLE: '1', TEST_REDIS_REST_URL: 'https://scratch.invalid', TEST_REDIS_REST_TOKEN: 'synthetic' });

test('disposable Redis guard rejects the application endpoint before any I/O', async () => {
  let reads = 0;
  for (const appUrl of ['https://scratch.invalid', 'https://scratch.invalid:443/']) {
    await assert.rejects(requireEmptyDisposableRedis({ dbsize: async () => { reads++; return 0; } }, { ...fixture(), UPSTASH_REDIS_REST_URL: appUrl }), /application Redis/i);
  }
  assert.equal(reads, 0);
});

test('disposable Redis guard refuses every nonempty database without mutating it', async () => {
  for (const count of [1, 10]) {
    await assert.rejects(requireEmptyDisposableRedis({ dbsize: async () => count }, fixture()), /empty/i);
  }
  await requireEmptyDisposableRedis({ dbsize: async () => 0 }, fixture());
});

test('missing acknowledgement or unsafe URL fails before disposable Redis access', async () => {
  let reads = 0;
  for (const change of [{ TEST_REDIS_DISPOSABLE: '0' }, { TEST_REDIS_REST_TOKEN: '' }, { TEST_REDIS_REST_URL: 'http://scratch.invalid' }, { TEST_REDIS_REST_URL: 'https://scratch.invalid/path' }]) {
    await assert.rejects(requireEmptyDisposableRedis({ dbsize: async () => { reads++; return 0; } }, { ...fixture(), ...change }), /disposable|HTTPS/i);
  }
  assert.equal(reads, 0);
});

test('synthetic sentinel is removed even if its verification throws', async () => {
  const values = new Map();
  const redis = { set: async (key, value) => values.set(key, value), del: async key => values.delete(key) };
  await assert.rejects(withSyntheticSentinel(redis, 'unknown:synthetic', async () => {
    assert.equal(values.get('unknown:synthetic'), 'block'); throw Error('assertion failed');
  }), /assertion failed/);
  assert.equal(values.has('unknown:synthetic'), false);
});
