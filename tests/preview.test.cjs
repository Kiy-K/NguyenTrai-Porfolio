const { test } = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const { NextResponse } = require('next/server');

function previewRoute(rateLimit) {
  return loadTs('app/api/preview/route.ts', {
    'next/server': { NextResponse },
    '@/lib/rate-limit': { consumeRateLimit: async () => { if (rateLimit instanceof Error) throw rateLimit; return rateLimit; } },
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

test('preview fails closed without fetching when the rate limiter is unavailable', async () => {
  const realFetch = global.fetch;
  let fetches = 0;
  global.fetch = async () => { fetches++; throw new Error('unexpected outbound fetch'); };
  try {
    const response = await previewRoute(new Error('redis down'))(
      new Request('https://test.invalid/api/preview?url=https://example.com/page')
    );
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('retry-after'), '30');
    assert.equal(fetches, 0);
  } finally {
    global.fetch = realFetch;
  }
});
