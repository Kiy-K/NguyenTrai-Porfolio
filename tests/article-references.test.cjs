const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const { NextResponse } = require('next/server');
const loadTs = require('./load-ts.cjs');
const referenceModule = loadTs('lib/article-references.ts');
const References = loadTs('components/ArticleReferences.tsx', { '@/lib/article-references': referenceModule }).default;
const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

test('legacy and empty lists render nothing; print sources and HTML are escaped', () => {
  for (const references of [undefined, []]) assert.equal(renderToStaticMarkup(References({ references })), '');
  const html = renderToStaticMarkup(References({ references: [
    { title: '<img src=x onerror=alert(1)>', author: '<script>alert(2)</script>', publisher: '<svg onload=alert(3)>' },
    { title: 'Online', url: 'https://example.org/?a=1&b=2' },
    { title: 'Unsafe stored link', url: 'javascript:alert(1)' },
    { title: 'Protocol relative stored link', url: '//example.org' },
  ] }));
  assert.match(html, /Nguồn tham khảo/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
  assert.match(html, /&lt;svg/);
  assert.doesNotMatch(html, /<(img|script|svg)\b|href="(?:javascript:|\/\/)/);
  assert.equal((html.match(/<a /g) || []).length, 1);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.ok(html.indexOf('&lt;img') < html.indexOf('Online'));
  assert.match(html, /<span>Unsafe stored link<\/span>/);
});

for (const backend of ['redis', 'postgres']) {
  test(`${backend}: validated create → persistence → public detail round-trip preserves legacy/media and private filtering`, async () => {
    process.env.PERSISTENCE_BACKEND = backend;
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
    delete process.env.APP_DATABASE_URL;
    delete process.env.DATA_WRITE_PAUSED;
    const legacy = { id: 'legacy', title: 'Legacy', images: ['unchanged'], video: 'old-video', videos: [{ muxPlaybackId: 'unchanged' }] };
    let content = { products: [legacy, { id: 'draft', status: 'draft', references: [{ title: 'PRIVATE' }] }, { id: 'archived', status: 'archived' }] };
    let invalidations = 0;
    const queries = [];
    const store = loadTs('lib/persistence.ts', {
      '@/lib/redis': { redis: {
        get: async () => structuredClone(content),
        set: async (key, value) => { assert.equal(key, 'portfolio_data_v4'); content = JSON.parse(JSON.stringify(value)); },
      } },
      '@/lib/product-cache': { invalidateProductCache: async () => { invalidations++; } },
      '@neondatabase/serverless': { neon: () => async (parts, ...params) => {
        const sql = parts.join('?'); queries.push(sql);
        if (sql.includes('UPDATE')) {
          assert.match(sql, /jsonb_set/);
          content.products.push(...JSON.parse(params[0]));
          return [{ key: 'portfolio_data_v4' }];
        }
        assert.match(sql, /SELECT payload/);
        return [{ payload: structuredClone(content) }];
      } },
    });
    const cache = loadTs('lib/product-cache.ts', { '@upstash/redis': { Redis: class {} } });
    const data = loadTs('lib/data.ts', {
      '@/lib/persistence': store,
      '@/lib/product-cache': { ...cache, readPublicProducts: async load => cache.publicProducts(await load()) },
    });
    const api = loadTs('app/api/products/route.ts', {
      'next/server': { NextResponse }, '@/lib/data': data, '@/lib/persistence': store,
      '@/lib/article-references': referenceModule, '@/lib/constants': loadTs('lib/constants.ts'),
      '@/lib/admin-auth': { getClientIpFromHeaders: () => 'ip', getActiveAdminSession: async () => ({}) },
      '@/lib/rate-limit': { consumeRateLimit: async () => ({ allowed: true }) },
      '@/lib/request-security': loadTs('lib/request-security.ts'),
    });
    const response = await api.POST(new Request('https://test.invalid/api/products', {
      method: 'POST', headers: { origin: 'https://test.invalid' }, body: JSON.stringify({
        title: 'New', description: 'Authored', section: 'Tranh vẽ', videos: [{ muxPlaybackId: 'Kept01' }],
        references: [{ title: ' Book ', author: ' Author ' }, { title: 'Site', url: 'https://example.org' }],
      }),
    }));
    assert.equal(response.status, 201);
    const { product } = await response.json();
    assert.deepEqual(content.products[0], legacy);
    assert.deepEqual(await data.getProduct(product.id), product);
    assert.deepEqual((await data.getProduct(product.id)).references, [{ title: 'Book', author: 'Author' }, { title: 'Site', url: 'https://example.org' }]);
    assert.equal((await data.getProduct('legacy')).references, undefined);
    const detail = loadTs('app/api/products/[id]/route.ts', { '@/lib/data': data });
    const get = id => detail.GET(new Request(`https://test.invalid/api/products/${id}`), { params: Promise.resolve({ id }) });
    const publicResponse = await get(product.id);
    assert.deepEqual((await publicResponse.json()).product, product);
    assert.equal(publicResponse.headers.get('cache-control'), 'no-store');
    for (const id of ['draft', 'archived']) assert.equal((await get(id)).status, 404);
    assert.equal(invalidations, backend === 'postgres' ? 1 : 0);
    assert.equal(queries.filter(sql => sql.includes('UPDATE')).length, backend === 'postgres' ? 1 : 0);
  });
}
