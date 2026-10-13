const { test } = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const { NextResponse } = require('next/server');

function previewRoute(rateLimit) {
  return loadTs('app/api/preview/route.ts', {
    'next/server': { NextResponse },
    '@/lib/rate-limit': { consumeRateLimit: async () => rateLimit },
    '@/lib/admin-auth': { getClientIpFromHeaders: () => 'test-ip' },
  }).GET;
}

test('preview errors are never stored in shared caches', async () => {
  const limited = await previewRoute({ allowed: false, retryAfterSeconds: 30 })(
    new Request('https://test.invalid/api/preview?url=https://youtube.com/watch?v=x')
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('cache-control'), 'no-store');
  assert.equal(limited.headers.get('retry-after'), '30');

  const invalid = await previewRoute({ allowed: true })(
    new Request('https://test.invalid/api/preview?url=ftp://example.com')
  );
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get('cache-control'), 'no-store');
});
