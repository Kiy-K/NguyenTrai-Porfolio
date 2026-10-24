const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const { NextResponse } = require('next/server');
const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

const existing = [{ id: 'a', title: 'A', description: 'a', images: ['https://res.cloudinary.com/demo/a.jpg'], muxPlaybackId: 'Play01', references: [{ title: 'Print source' }, { title: 'Web source', url: 'https://example.org' }] }];

function deleteRoute() {
  process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
  const writes = [];
  const reads = [];
  const constants = loadTs('lib/constants.ts');
  const route = loadTs('app/api/products/route.ts', {
    'next/server': { NextResponse },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/data': { getProducts: async () => [] },
    '@/lib/persistence': { readContent: async () => { reads.push(1); return { products: existing }; }, writeContent: async (content) => { writes.push(content); }, appendProduct: async () => {} },
    '@/lib/admin-auth': { getClientIpFromHeaders: () => 'test-ip', getActiveAdminSession: async () => ({ sessionId: 'test' }) },
    '@/lib/rate-limit': { consumeRateLimit: async () => ({ allowed: true }) },
    '@/lib/request-security': loadTs('lib/request-security.ts'),
    '@/lib/article-references': loadTs('lib/article-references.ts'),
    '@/lib/constants': constants,
  });
  const del = (body) => route.DELETE(new Request('https://test.invalid/api/products', {
    method: 'DELETE',
    headers: { origin: 'https://test.invalid', 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
  return { del, writes, reads, phrase: constants.CLEAR_ALL_CONFIRMATION };
}

test('bulk delete without the typed confirmation never touches storage', async () => {
  const { del, writes, reads } = deleteRoute();
  for (const body of [undefined, {}, { confirm: 'yes' }]) {
    assert.equal((await del(body)).status, 400);
  }
  assert.equal(reads.length, 0);
  assert.equal(writes.length, 0);
});

test('confirmed bulk delete returns the removed products for recovery', async () => {
  const { del, writes, phrase } = deleteRoute();
  const res = await del({ confirm: phrase });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(writes, [{ products: [] }]);
  assert.deepEqual((await res.json()).deleted, existing);
});
