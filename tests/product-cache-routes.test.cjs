const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { NextResponse } = require('next/server');
const loadTs = require('./load-ts.cjs');
const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });
const all = [{ id: 'published' }, { id: 'draft', status: 'draft' }];
function route({ authenticated = false, failure = false } = {}) {
  let publicReads = 0, freshReads = 0;
  const api = loadTs('app/api/products/route.ts', {
    'next/server': { NextResponse }, 'next/cache': { revalidatePath() {} },
    '@/lib/data': { getProducts: async () => { publicReads++; return all.slice(0, 1); } },
    '@/lib/persistence': { readContent: async () => { freshReads++; if (failure) throw Error('Neon unavailable'); return { products: all }; } },
    '@/lib/constants': loadTs('lib/constants.ts'),
    '@/lib/admin-auth': { getClientIpFromHeaders: () => 'ip', getActiveAdminSession: async () => authenticated ? {} : null },
    '@/lib/request-security': {}, '@/lib/rate-limit': {},
  });
  return { api, counts: () => ({ publicReads, freshReads }) };
}
test('public product API is no-store and uses only public cache reads', async () => {
  const s = route(); const res = await s.api.GET(new Request('https://test.invalid/api/products'));
  assert.equal(res.headers.get('cache-control'), 'no-store'); assert.deepEqual((await res.json()).products, all.slice(0, 1));
  assert.deepEqual(s.counts(), { publicReads: 1, freshReads: 0 });
});
test('fresh product reads require auth and bypass public cache including drafts', async () => {
  const anonymous = route(); const denied = await anonymous.api.GET(new Request('https://test.invalid/api/products?fresh=1'));
  assert.equal(denied.status, 401); assert.equal(denied.headers.get('cache-control'), 'no-store'); assert.equal(anonymous.counts().freshReads, 0);
  const admin = route({ authenticated: true }); const res = await admin.api.GET(new Request('https://test.invalid/api/products?fresh=1'));
  assert.deepEqual((await res.json()).products, all); assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(admin.counts(), { publicReads: 0, freshReads: 1 });
});
test('fresh admin database outage returns a no-store error, never an empty list', async () => {
  const s = route({ authenticated: true, failure: true });
  const res = await s.api.GET(new Request('https://test.invalid/api/products?fresh=1'));
  assert.equal(res.status, 500); assert.equal(res.headers.get('cache-control'), 'no-store'); assert.equal((await res.json()).products, undefined);
});

test('every successful Neon content mutation invalidates; failed updates never do', async () => {
  process.env.PERSISTENCE_BACKEND = 'postgres'; process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
  let calls = 0, success = true;
  const store = loadTs('lib/persistence.ts', {
    '@/lib/redis': {}, '@/lib/product-cache': { invalidateProductCache: async () => { calls++; } },
    '@neondatabase/serverless': { neon: () => async () => success ? [{ key: 'portfolio_data_v4' }] : [] },
  });
  await store.appendProduct(all[0]); assert.equal(calls, 1);
  await store.writeContent({ products: [] }); assert.equal(calls, 2);
  success = false;
  await assert.rejects(store.appendProduct(all[0])); await assert.rejects(store.writeContent({ products: [] })); assert.equal(calls, 2);
});

test('data reads exclude unpublished content and propagate database errors without Next caching', async () => {
  process.env.PERSISTENCE_BACKEND = 'postgres';
  let failed = false;
  const cache = loadTs('lib/product-cache.ts', { '@upstash/redis': { Redis: class {} } });
  delete process.env.UPSTASH_REDIS_REST_URL;
  const data = loadTs('lib/data.ts', {
    '@/lib/persistence': { usesPostgres: () => true, readContent: async () => { if (failed) throw Error('Neon unavailable'); return { products: all }; } },
    '@/lib/product-cache': cache,
  });
  assert.deepEqual(await data.getProducts(), all.slice(0, 1)); assert.equal(await data.getProduct('draft'), undefined);
  failed = true; await assert.rejects(data.getProducts(), /Neon unavailable/);
});
