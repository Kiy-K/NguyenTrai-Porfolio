const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { NextResponse } = require('next/server');
const loadTs = require('./load-ts.cjs');
const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });
const rev = 'a'.repeat(64);

function setup({ authenticated = true, allowed = true, result = 'updated' } = {}) {
  const calls = [];
  const route = loadTs('app/api/products/[id]/route.ts', {
    'next/server': { NextResponse }, '@/lib/data': {},
    '@/lib/persistence': { updateProduct: async (...args) => { calls.push(args); return result; } },
    '@/lib/admin-auth': { getClientIpFromHeaders: () => 'ip', getActiveAdminSession: async () => authenticated ? {} : null },
    '@/lib/rate-limit': { consumeRateLimit: async () => ({ allowed, retryAfterSeconds: 7 }) },
    '@/lib/request-security': loadTs('lib/request-security.ts'),
    '@/lib/product-input': loadTs('lib/product-input.ts', { '@/lib/constants': loadTs('lib/constants.ts'), '@/lib/article-references': loadTs('lib/article-references.ts') }),
  });
  const patch = (body, { origin = 'https://test.invalid', id = 'p1' } = {}) => route.PATCH(new Request(`https://test.invalid/api/products/${id}`, {
    method: 'PATCH', headers: { ...(origin && { origin }), 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }), { params: Promise.resolve({ id }) });
  return { patch, calls };
}

test('PATCH enforces origin, write pause, auth and rate limit before writing', async () => {
  let s = setup(); assert.equal((await s.patch({ revision: rev, changes: { title: 'x' } }, { origin: 'https://evil.invalid' })).status, 403);
  process.env.DATA_WRITE_PAUSED = '1'; assert.equal((await s.patch({ revision: rev, changes: { title: 'x' } })).status, 503);
  delete process.env.DATA_WRITE_PAUSED;
  s = setup({ authenticated: false }); assert.equal((await s.patch({ revision: rev, changes: { title: 'x' } })).status, 401);
  s = setup({ allowed: false }); const limited = await s.patch({ revision: rev, changes: { title: 'x' } });
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '7');
  assert.equal(s.calls.length, 0);
});

test('PATCH rejects malformed, empty, oversize and protected-only bodies', async () => {
  const s = setup();
  for (const body of ['{', { changes: { title: 'x' } }, { revision: 'nope', changes: { title: 'x' } }, { revision: rev, changes: {} },
    { revision: rev, changes: { id: 'z', status: 'draft', createdAt: 'x' } }, { revision: rev, changes: { title: null } },
    { revision: rev, changes: { section: 'Not a section' } }, { revision: rev, changes: { fullDescription: 'x'.repeat(1_100_000) } }]) {
    assert.equal((await s.patch(body)).status, 400, JSON.stringify(body).slice(0, 60));
  }
  assert.equal(s.calls.length, 0);
});

test('PATCH sends only known changed keys; null removes optional keys; unknown keys stripped', async () => {
  const s = setup();
  const res = await s.patch({ revision: rev, changes: { title: ' New ', teamMembers: null, id: 'hack', status: 'draft', extra: 1 } });
  assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(s.calls, [['p1', rev, { title: 'New' }, ['teamMembers']]]);
});

test('PATCH maps persistence results to 404/409/503', async () => {
  for (const [result, status] of [['not_found', 404], ['conflict', 409], ['duplicate', 503], ['unsupported', 503]]) {
    assert.equal((await setup({ result }).patch({ revision: rev, changes: { title: 'x' } })).status, status, result);
  }
});

test('updateProduct: single conditional Neon UPDATE, invalidates only on success, classifies failures', async () => {
  process.env.PERSISTENCE_BACKEND = 'postgres'; process.env.DATABASE_URL = 'postgresql://t:t@localhost/t';
  for (const [updateRows, count, expected, inv] of [[[{ key: 'k' }], 1, 'updated', 1], [[], 0, 'not_found', 0], [[], 1, 'conflict', 0], [[], 2, 'duplicate', 0]]) {
    const queries = []; let invalidations = 0;
    const store = loadTs('lib/persistence.ts', {
      '@/lib/redis': {}, '@/lib/product-cache': { invalidateProductCache: async () => { invalidations++; } },
      '@neondatabase/serverless': { neon: () => async (parts) => { const q = parts.join('?'); queries.push(q); return q.includes('UPDATE') ? updateRows : [{ n: count }]; } },
    });
    assert.equal(await store.updateProduct('p1', rev, { title: 'x' }, []), expected);
    assert.equal(invalidations, inv);
    assert.match(queries[0], /UPDATE portfolio\.state[\s\S]*ORDINALITY[\s\S]*sha256/);
  }
  delete process.env.DATABASE_URL; process.env.PERSISTENCE_BACKEND = 'redis';
  assert.equal(await loadTs('lib/persistence.ts', { '@/lib/redis': {}, '@/lib/product-cache': {}, '@neondatabase/serverless': {} }).updateProduct('p', rev, {}, []), 'unsupported');
});
