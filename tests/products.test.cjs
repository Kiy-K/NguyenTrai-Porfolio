const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const { NextResponse } = require('next/server');
const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

function productsRoute({ authenticated = true, allowed = true, origin = 'https://test.invalid' } = {}) {
  process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
  const appended = [];
  const route = loadTs('app/api/products/route.ts', {
    'next/server': { NextResponse },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/data': { getProducts: async () => [] },
    '@/lib/persistence': { appendProduct: async (product) => { appended.push(product); }, writeContent: async () => {} },
    '@/lib/admin-auth': { getClientIpFromHeaders: () => 'test-ip', getActiveAdminSession: async () => authenticated ? { sessionId: 'test' } : null },
    '@/lib/rate-limit': { consumeRateLimit: async () => ({ allowed, retryAfterSeconds: 30 }) },
    '@/lib/request-security': loadTs('lib/request-security.ts'),
    '@/lib/article-references': loadTs('lib/article-references.ts'),
    '@/lib/constants': loadTs('lib/constants.ts'),
  });
  const post = (body) => route.POST(new Request('https://test.invalid/api/products', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
  return { post, appended, api: route };
}

const adminPayload = {
  title: ' Bình Ngô đại cáo ',
  description: 'Mô tả ngắn',
  fullDescription: '',
  images: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
  muxAssetId: 'Asset01',
  muxPlaybackId: 'Playback01',
  videos: [{ video: 'https://youtu.be/abc' }, { muxAssetId: 'Asset01', muxPlaybackId: 'Playback01' }],
  section: 'Tranh vẽ',
};

test('product creation stores only validated fields with a server-generated id', async () => {
  const { post, appended } = productsRoute();
  const res = await post({ ...adminPayload, id: '1', status: 'published', injected: '<script>' });
  assert.equal(res.status, 201);
  assert.equal(appended.length, 1);
  const [saved] = appended;
  assert.match(saved.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(saved.title, 'Bình Ngô đại cáo');
  assert.equal(saved.status, undefined);
  assert.equal(saved.injected, undefined);
  assert.deepEqual(saved.videos, adminPayload.videos);
  assert.equal((await res.json()).product.id, saved.id);
});

test('invalid product payloads are rejected before storage', async () => {
  const { post, appended } = productsRoute();
  for (const body of [
    'not json',
    { ...adminPayload, title: '  ' },
    { ...adminPayload, section: 'Unknown' },
    { ...adminPayload, images: ['javascript:alert(1)'] },
    { ...adminPayload, videos: [{ muxPlaybackId: '../x' }] },
    { ...adminPayload, description: 'x'.repeat(2001) },
  ]) {
    assert.equal((await post(body)).status, 400, JSON.stringify(body).slice(0, 60));
  }
  // The admin UI shows this message, so it must name the offending field.
  const badMux = await post({ ...adminPayload, videos: [{ muxPlaybackId: '../x' }] });
  assert.match((await badMux.json()).error, /videos\.0\.muxPlaybackId/);
  assert.equal(appended.length, 0);
});

test('references are optional, normalized, ordered and returned with the created product', async () => {
  const { post, appended } = productsRoute();
  for (const references of [undefined, [], [
    { title: '  Sách in  ', author: ' Tác giả ', publisher: ' Ấn bản ', url: '  ', unknown: 'stripped' },
    { title: 'Nguồn trực tuyến', url: ' https://example.org/source ', author: '', publisher: '' },
  ]]) {
    const res = await post({ ...adminPayload, references });
    assert.equal(res.status, 201);
    const { product } = await res.json();
    assert.deepEqual(product, JSON.parse(JSON.stringify(appended.at(-1))));
  }
  assert.equal(appended[0].references, undefined);
  assert.deepEqual(appended[1].references, []);
  assert.deepEqual(JSON.parse(JSON.stringify(appended[2].references)), [
    { title: 'Sách in', author: 'Tác giả', publisher: 'Ấn bản' },
    { title: 'Nguồn trực tuyến', url: 'https://example.org/source' },
  ]);
  assert.deepEqual(appended[2].videos, adminPayload.videos);
});

test('malformed, insecure and unbounded references are rejected before append', async () => {
  const { post, appended } = productsRoute();
  for (const references of [
    null, {}, ['source'], [null], [{}], [{ title: '' }], [{ title: '  ' }],
    [{ title: 12 }], [{ title: 'a'.repeat(301) }],
    ...['javascript:alert(1)', 'data:text/html,test', 'ftp://example.org', '//example.org', '/source', 'https://', 'http:example.org', 'https://exa mple.org', 'https://example.org/\nx', 'https://[invalid'].map(url => [{ title: 'Source', url }]),
    [{ title: 'Source', url: 'https://example.org/' + 'a'.repeat(2048) }],
    [{ title: 'Source', author: 'a'.repeat(201) }],
    [{ title: 'Source', publisher: 'a'.repeat(201) }],
    [{ title: 'Source', author: null }],
    Array.from({ length: 21 }, () => ({ title: 'Source' })),
  ]) {
    const res = await post({ ...adminPayload, references });
    assert.equal(res.status, 400, JSON.stringify(references).slice(0, 100));
    assert.match((await res.json()).error, /\(references(?:\.|\))/);
  }
  assert.equal(appended.length, 0);
  const accepted = Array.from({ length: 20 }, (_, i) => ({ title: String(i).padEnd(300, 'a'), author: 'a'.repeat(200), publisher: 'p'.repeat(200), url: 'https://example.org/'.padEnd(2048, 'a') }));
  assert.equal((await post({ ...adminPayload, references: accepted })).status, 201);
});

test('references never bypass origin, session, rate limit or write pause gates', async () => {
  const body = { ...adminPayload, references: [{ title: 'Source' }] };
  for (const [options, expected] of [
    [{ origin: 'https://evil.invalid' }, 403],
    [{ authenticated: false }, 401],
    [{ allowed: false }, 429],
  ]) {
    const { post, appended } = productsRoute(options);
    const response = await post(body);
    assert.equal(response.status, expected);
    if (expected === 429) assert.equal(response.headers.get('retry-after'), '30');
    assert.equal(appended.length, 0);
  }
  const { post, appended } = productsRoute();
  process.env.DATA_WRITE_PAUSED = '1';
  const response = await post(body);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('x-data-write-paused'), '1');
  assert.equal(appended.length, 0);
});

test('the create body is bounded to 1 MiB even without Content-Length', async () => {
  const { post, appended } = productsRoute();
  const response = await post({ ...adminPayload, ignored: 'x'.repeat(1_048_576) });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /\(body\)/);
  assert.equal(appended.length, 0);
});

test('streamed input preserves split UTF-8 reference text and cancels oversized streams', async () => {
  const { api, appended } = productsRoute();
  const reference = { title: 'Nguồn Nguyễn Trãi', author: 'Tác giả Việt Nam' };
  const encoded = new TextEncoder().encode(JSON.stringify({ ...adminPayload, references: [reference] }));
  const request = body => new Request('https://test.invalid/api/products', {
    method: 'POST', headers: { origin: 'https://test.invalid' }, body, duplex: 'half',
  });
  const success = await api.POST(request(new ReadableStream({ start(controller) {
    for (const byte of encoded) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } })));
  assert.equal(success.status, 201);
  assert.deepEqual((await success.json()).product.references, [reference]);
  let cancelled = false;
  const oversized = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(600_000)); },
    cancel() { cancelled = true; },
  });
  assert.equal((await api.POST(request(oversized))).status, 400);
  assert.equal(cancelled, true);
  assert.equal(appended.length, 1);
});
