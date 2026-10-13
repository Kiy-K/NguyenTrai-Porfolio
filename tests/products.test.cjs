const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const { NextResponse } = require('next/server');
const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

function productsRoute() {
  process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
  const appended = [];
  const route = loadTs('app/api/products/route.ts', {
    'next/server': { NextResponse },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/data': { getProducts: async () => [] },
    '@/lib/persistence': { appendProduct: async (product) => { appended.push(product); }, writeContent: async () => {} },
    '@/lib/admin-auth': { getClientIpFromHeaders: () => 'test-ip', getActiveAdminSession: async () => ({ sessionId: 'test' }) },
    '@/lib/rate-limit': { consumeRateLimit: async () => ({ allowed: true }) },
    '@/lib/request-security': loadTs('lib/request-security.ts'),
    '@/lib/constants': loadTs('lib/constants.ts'),
  });
  const post = (body) => route.POST(new Request('https://test.invalid/api/products', {
    method: 'POST',
    headers: { origin: 'https://test.invalid', 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
  return { post, appended };
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
