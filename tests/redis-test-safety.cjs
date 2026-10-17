const assert = require('node:assert/strict');

async function requireEmptyDisposableRedis(redis, env = process.env) {
  assert.equal(env.TEST_REDIS_DISPOSABLE, '1', 'Explicit disposable database acknowledgement required');
  assert.ok(env.TEST_REDIS_REST_TOKEN, 'A disposable Redis token is required');
  let target;
  try { target = new URL(env.TEST_REDIS_REST_URL); } catch { throw new Error('A disposable HTTPS Redis origin is required'); }
  assert.ok(target.protocol === 'https:' && !target.username && !target.password && target.pathname === '/' && !target.search && !target.hash, 'A disposable HTTPS Redis origin is required');
  if (env.UPSTASH_REDIS_REST_URL) {
    assert.notEqual(target.origin, new URL(env.UPSTASH_REDIS_REST_URL).origin, 'Refusing the application Redis endpoint');
  }
  assert.equal(await redis.dbsize(), 0, 'Disposable Redis must be empty before synthetic setup');
}
async function withSyntheticSentinel(redis, key, check) {
  try { await redis.set(key, 'block'); await check(); }
  finally { await redis.del(key); }
}
module.exports = { requireEmptyDisposableRedis, withSyntheticSentinel };
