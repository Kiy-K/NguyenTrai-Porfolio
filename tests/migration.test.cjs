const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const { NextResponse } = require('next/server');
const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

function storage(redis = {}, rows = []) {
  const queries = [];
  const sql = async (parts, ...params) => { queries.push({ text: parts.join('?'), params }); return rows.shift() || []; };
  const store = loadTs('lib/persistence.ts', { '@/lib/product-cache': { invalidateProductCache: async () => {} }, '@/lib/redis': { redis }, '@neondatabase/serverless': { neon: () => sql } });
  return { store, queries };
}

test('write pause prevents authorized credential provisioning before mutation', async () => {
  process.env.DATA_WRITE_PAUSED = '1';
  process.env.ADMIN_BOOTSTRAP_TOKEN = 'owner-token'.repeat(8);
  process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
  let writes = 0;
  const post = loadTs('app/api/admin/auth/bootstrap/route.ts', {
    'next/server': { NextResponse },
    '@/lib/admin-auth': { getClientIpFromHeaders: () => 'test-ip', bootstrapAdminCredentials: async () => { writes++; return { created: true, password: 'test-password' }; } },
    '@/lib/rate-limit': { consumeRateLimit: async () => ({ allowed: true }) },
    '@/lib/request-security': loadTs('lib/request-security.ts'),
  }).POST;
  const response = await post(new Request('https://test.invalid/api/admin/auth/bootstrap', { method: 'POST', headers: { origin: 'https://test.invalid', 'x-admin-bootstrap-token': process.env.ADMIN_BOOTSTRAP_TOKEN } }));
  assert.equal(response.status, 503);
  assert.equal(writes, 0);
});

test('Redis remains the default and existing content is preserved', async () => {
  delete process.env.PERSISTENCE_BACKEND;
  const content = { products: [{ id: 'original', videos: [{ muxPlaybackId: 'unchanged' }] }], metadata: 'retain' };
  const { store, queries } = storage({ get: async key => { assert.equal(key, 'portfolio_data_v4'); return content; } });
  assert.deepEqual(await store.readContent(), content);
  assert.equal(queries.length, 0);
});

test('unknown backend and missing PostgreSQL configuration fail closed', async () => {
  const { store } = storage();
  process.env.PERSISTENCE_BACKEND = 'typo';
  assert.throws(() => store.usesPostgres(), /backend/i);
  process.env.PERSISTENCE_BACKEND = 'postgres';
  delete process.env.DATABASE_URL; delete process.env.APP_DATABASE_URL;
  await assert.rejects(store.readContent(), /DATABASE_URL/);
});

test('runtime connection prefers the least-privilege APP_DATABASE_URL over the owner DATABASE_URL', async () => {
  process.env.PERSISTENCE_BACKEND = 'postgres';
  process.env.DATABASE_URL = 'postgresql://owner:o@localhost/test';
  const urls = [];
  const connect = () => loadTs('lib/persistence.ts', { '@/lib/product-cache': { invalidateProductCache: async () => {} }, '@/lib/redis': { redis: {} }, '@neondatabase/serverless': { neon: url => { urls.push(url); return async () => [{ payload: { products: [] } }]; } } });
  await connect().readContent();
  process.env.APP_DATABASE_URL = 'postgresql://portfolio_app:a@localhost/test';
  await connect().readContent();
  assert.deepEqual(urls, ['postgresql://owner:o@localhost/test', 'postgresql://portfolio_app:a@localhost/test']);
});

test('PostgreSQL reads require imported content and never fall back to Redis', async () => {
  process.env.PERSISTENCE_BACKEND = 'postgres'; process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
  const { store } = storage(new Proxy({}, { get: () => () => { throw new Error('Redis fallback forbidden'); } }));
  await assert.rejects(store.readContent(), /content/i);
});

test('PostgreSQL provisioning uses atomic insert and reports only a winning insert', async () => {
  process.env.PERSISTENCE_BACKEND = 'postgres'; process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
  const { store, queries } = storage({}, [[{ key: 'admin:credentials:v1' }], []]);
  const fields = { passwordHash: 'hash', passwordSalt: 'salt', passwordScheme: 'pbkdf2-v1', createdAt: 'original' };
  assert.equal(await store.createCredentials(fields), true);
  assert.equal(await store.createCredentials(fields), false);
  assert.match(queries[0].text, /ON CONFLICT.*DO NOTHING/s);
  assert.ok(queries[0].params.includes(JSON.stringify(fields)));
});

test('PostgreSQL append is one atomic JSONB update, preserving other content fields', async () => {
  process.env.PERSISTENCE_BACKEND = 'postgres'; process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
  const { store, queries } = storage({}, [[{ key: 'portfolio_data_v4' }]]);
  const product = { id: 'existing-id', images: ['https://example.test/image'], videos: [{ video: 'legacy-reference' }] };
  await store.appendProduct(product);
  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /UPDATE portfolio\.state/);
  assert.match(queries[0].text, /jsonb_set/);
  assert.ok(queries[0].params.includes(JSON.stringify([product])));
});

test('PostgreSQL credential updates merge fields and cannot initialize a missing key', async () => {
  process.env.PERSISTENCE_BACKEND = 'postgres'; process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
  const { store, queries } = storage({}, [[]]);
  await assert.rejects(store.updateCredentials({ passwordHash: 'upgraded' }), /credential/i);
  assert.match(queries[0].text, /payload = payload \|\|/);
});

for (const [file, method] of [
  ['app/api/products/route.ts', 'POST'], ['app/api/products/route.ts', 'DELETE'],
  ['app/api/feedback/route.ts', 'POST'], ['app/api/admin/auth/login/route.ts', 'POST'],
]) {
  test(`write pause blocks ${method} ${file} before I/O`, async () => {
    process.env.DATA_WRITE_PAUSED = '1';
    const noIo = new Proxy({}, { get: () => () => { throw new Error('Unexpected mutation I/O'); } });
    const route = loadTs(file, {
      'next/server': { NextResponse }, 'next/cache': noIo, '@/lib/data': noIo,
      '@/lib/persistence': noIo, '@/lib/redis': { redis: noIo },
      '@/lib/admin-auth': noIo, '@/lib/rate-limit': noIo, '@/lib/feedback-search': noIo,
      '@/lib/article-references': loadTs('lib/article-references.ts'),
      '@/lib/request-security': loadTs('lib/request-security.ts'), '@/lib/constants': loadTs('lib/constants.ts'),
    });
    const res = await route[method](new Request('https://test.invalid/api/test', { method, headers: { origin: 'https://test.invalid' } }));
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('retry-after'), '60');
  });
}

test('PostgreSQL rejects malformed imported content instead of returning an empty page', async () => {
  process.env.PERSISTENCE_BACKEND = 'postgres'; process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
  const { store } = storage({}, [[{ payload: { products: {} } }]]);
  await assert.rejects(store.readContent(), /content/i);
});
