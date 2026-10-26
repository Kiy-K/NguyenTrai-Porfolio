const { test } = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const { NextResponse } = require('next/server');

function previewRoute(rateLimit, mocks = {}) {
  return loadTs('app/api/preview/route.ts', {
    'next/server': { NextResponse },
    'sanitize-html': { default: require('sanitize-html') },
    '@/lib/rate-limit': { consumeRateLimit: async () => { if (rateLimit instanceof Error) throw rateLimit; return rateLimit; } },
    '@/lib/admin-auth': { getClientIpFromHeaders: () => 'test-ip' },
    '@/lib/preview-policy': loadTs('lib/preview-policy.ts'),
    ...mocks,
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

test('preview still rejects unsupported hosts, restricted DNS, credentials, ports and unsafe redirects', async () => {
  const realFetch = global.fetch;
  let fetches = 0;
  global.fetch = async () => {
    fetches++;
    return new Response(null, { status: 302, headers: { location: 'https://outside.example/article' } });
  };
  try {
    for (const [url, address] of [
      ['https://outside.example/article', '93.184.216.34'],
      ['https://github.com.evil.example/article', '93.184.216.34'],
      ['https://github.com/article', '127.0.0.1'],
      ['https://user:password@github.com/article', '93.184.216.34'],
      ['https://github.com:8080/article', '93.184.216.34'],
    ]) {
      const get = previewRoute({ allowed: true }, {
        'node:dns/promises': { lookup: async () => [{ address, family: 4 }] },
      });
      const response = await get(new Request(`https://test.invalid/api/preview?url=${encodeURIComponent(url)}`));
      assert.equal(response.status, 400);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(fetches, 0);
    }
    const get = previewRoute({ allowed: true }, {
      'node:dns/promises': { lookup: async () => [{ address: '93.184.216.34', family: 4 }] },
    });
    const redirect = await get(new Request('https://test.invalid/api/preview?url=https://github.com/article'));
    assert.equal(redirect.status, 400);
    assert.equal(fetches, 1);
  } finally { global.fetch = realFetch; }
});

test('allowed preview metadata still loads and upstream errors stay no-store', async () => {
  const realFetch = global.fetch;
  const get = previewRoute({ allowed: true }, {
    'node:dns/promises': { lookup: async () => [{ address: '93.184.216.34', family: 4 }] },
  });
  const request = () => new Request('https://test.invalid/api/preview?url=https://github.com/article');
  try {
    global.fetch = async () => new Response('<title>Synthetic preview</title><meta property="og:image" content="/cover.jpg">', {
      headers: { 'content-type': 'text/html' },
    });
    const success = await get(request());
    assert.equal(success.status, 200);
    assert.match(success.headers.get('cache-control'), /s-maxage=3600/);
    const metadata = await success.json();
    assert.equal(metadata.title, 'Synthetic preview');
    assert.equal(metadata.image, 'https://github.com/cover.jpg');
    global.fetch = async () => new Response(null, { status: 403 });
    const failure = await get(request());
    assert.equal(failure.status, 502);
    assert.equal(failure.headers.get('cache-control'), 'no-store');
  } finally { global.fetch = realFetch; }
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
