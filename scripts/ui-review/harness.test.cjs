const { test } = require('node:test');
const assert = require('node:assert/strict');
const { origin, localEnv, receipt, artifact } = require('./common.cjs');
const products = require('./fixtures.cjs');
test('synthetic harness pins loopback, pauses writes and clears provider credentials', () => {
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  const env = localEnv();
  assert.equal(env.PERSISTENCE_BACKEND, 'redis');
  assert.equal(env.DATA_WRITE_PAUSED, '1');
  for (const key of ['DATABASE_URL', 'APP_DATABASE_URL', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'GEMINI_API_KEY', 'MISTRAL_API_KEY', 'CLOUDINARY_URL', 'MUX_TOKEN_ID', 'MUX_TOKEN_SECRET', 'ADMIN_BOOTSTRAP_TOKEN']) assert.equal(env[key], '');
  assert.equal(products.filter(product => product.section === 'Tư tưởng nhân nghĩa' && product.status === 'published').length, 31);
  assert.ok(products.some(product => product.status === 'draft'));
});

test('generated receipts include runtime and source provenance', () => {
  const fs = require('node:fs');
  const name = `receipt-selfcheck-${process.pid}.json`;
  try {
    receipt(name, { passed: true });
    const saved = JSON.parse(fs.readFileSync(artifact(name), 'utf8'));
    assert.equal(saved.nodeVersion, process.version);
    assert.match(saved.revision, /^[a-f0-9]{40}$/);
    assert.equal(saved.origin, origin);
    assert.ok(Number.isFinite(Date.parse(saved.observedAt)));
    assert.deepEqual(saved.result, { passed: true });
  } finally {
    fs.rmSync(artifact(name), { force: true });
  }
});
