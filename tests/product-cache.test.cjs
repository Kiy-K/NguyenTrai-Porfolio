const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });
function setup() {
  process.env.UPSTASH_REDIS_REST_URL = 'https://cache.test'; process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic'; process.env.DATABASE_URL = 'postgresql://owner:password@ep-test.neon.tech/db';
  let now = 1000, calls = 0, broken = false;
  const keys = new Map(), configs = [];
  const get = key => { const row = keys.get(key); if (!row || row.expires <= now) return null; return row.value; };
  const set = (key, value, ttl) => keys.set(key, { value, expires: now + ttl });
  class Redis {
    constructor(config) { configs.push(config); }
    async eval(script, [epoch, payload], args) {
      calls++; if (broken) throw Error('Redis unavailable');
      if (script.includes('cache:read')) {
        set(epoch, get(epoch) || args[0], 120000);
        return { token: get(epoch), payload: get(payload) || false, deadline: now + 60000 };
      }
      if (script.includes('cache:publish')) {
        if (get(epoch) !== args[0] || Number(args[2]) <= now) return 0;
        set(payload, args[1], Number(args[2]) - now); return 1;
      }
      assert.ok(script.includes('cache:invalidate'));
      set(epoch, args[0], 120000); keys.delete(payload); return 1;
    }
  }
  const instance = () => loadTs('lib/product-cache.ts', { '@upstash/redis': { Redis } });
  return { instance, advance: ms => { now += ms; }, outage: value => { broken = value; }, calls: () => calls, configs, keys };
}
const publicProduct = { id: 'one', images: ['cloudinary/keep'], videos: [{ muxPlaybackId: 'keep' }] };

test('cache hit avoids source reads and TTL expires exactly within 60 seconds', async () => {
  const s = setup(), cache = s.instance(); let reads = 0;
  const source = async () => { reads++; return [publicProduct]; };
  assert.deepEqual(await cache.readPublicProducts(source), [publicProduct]);
  assert.deepEqual(await cache.readPublicProducts(source), [publicProduct]); assert.equal(reads, 1);
  s.advance(59999); await cache.readPublicProducts(source); assert.equal(reads, 1);
  s.advance(1); await cache.readPublicProducts(source); assert.equal(reads, 2);
  assert.equal(s.configs[0].retry, false); assert.ok(s.configs[0].signal() instanceof AbortSignal);
});

test('drafts, archives and unknown status never enter the public cache', async () => {
  const s = setup(), cache = s.instance();
  const all = [publicProduct, { id: 'pub', status: 'published' }, { id: 'draft', status: 'draft' }, { id: 'archived', status: 'archived' }, { id: 'private', status: 'private' }];
  assert.deepEqual(await cache.readPublicProducts(async () => all), all.slice(0, 2));
  const serialized = [...s.keys.values()].map(v => v.value).join('');
  for (const secret of ['draft', 'archived', 'private']) assert.equal(serialized.includes(secret), false);
});

test('independent instances share cache and invalidation after successful mutation', async () => {
  const s = setup(), a = s.instance(), b = s.instance(); let data = [publicProduct], reads = 0;
  const source = async () => { reads++; return data; };
  await a.readPublicProducts(source); await b.readPublicProducts(source); assert.equal(reads, 1);
  data = [{ id: 'new' }]; await b.invalidateProductCache();
  assert.deepEqual(await a.readPublicProducts(source), data); assert.equal(reads, 2);
});

test('invalidation fences old reads across instances', async () => {
  const s = setup(), a = s.instance(), b = s.instance(); let release;
  const waiting = a.readPublicProducts(() => new Promise(resolve => { release = resolve; }));
  await new Promise(resolve => setImmediate(resolve));
  await b.invalidateProductCache(); release([publicProduct]); await waiting;
  assert.deepEqual(await b.readPublicProducts(async () => [{ id: 'new' }]), [{ id: 'new' }]);
});

test('failed invalidation and late fills cannot extend staleness beyond read start plus TTL', async () => {
  const s = setup(), a = s.instance(), b = s.instance(); let release;
  const waiting = a.readPublicProducts(() => new Promise(resolve => { release = resolve; }));
  await new Promise(resolve => setImmediate(resolve));
  s.advance(59000); s.outage(true); await b.invalidateProductCache(); s.outage(false);
  release([publicProduct]); await waiting;
  s.advance(1001);
  assert.deepEqual(await b.readPublicProducts(async () => [{ id: 'new' }]), [{ id: 'new' }]);
});

test('reads slower than TTL cannot populate the cache, even after epoch expiry', async () => {
  const s = setup(), a = s.instance();
  await a.readPublicProducts(async () => { s.advance(121000); return [publicProduct]; });
  assert.deepEqual(await a.readPublicProducts(async () => [{ id: 'new' }]), [{ id: 'new' }]);
});

test('Redis failures fall back to source and Neon outages never become empty data', async () => {
  const s = setup(), a = s.instance(); s.outage(true);
  assert.deepEqual(await a.readPublicProducts(async () => [publicProduct]), [publicProduct]);
  await assert.rejects(a.readPublicProducts(async () => { throw Error('Neon unavailable'); }), /Neon unavailable/);
  s.outage(false);
  await assert.rejects(a.readPublicProducts(async () => { throw Error('Neon unavailable'); }), /Neon unavailable/);
  s.outage(true); await a.invalidateProductCache();
});

test('namespace separates databases and credentials do not appear in keys', () => {
  const s = setup(), a = s.instance();
  const original = a.productCacheKeys();
  process.env.DATABASE_URL = 'postgresql://other:secret@ep-test-pooler.neon.tech/db';
  assert.deepEqual(a.productCacheKeys(), original);
  process.env.DATABASE_URL = 'postgresql://other:secret@ep-other.neon.tech/db';
  assert.notDeepEqual(a.productCacheKeys(), original);
  assert.equal(original.join('').includes('password'), false);
});

test('cache constructor and fill failures preserve source results and committed writes', async () => {
  setup();
  const broken = loadTs('lib/product-cache.ts', { '@upstash/redis': { Redis: class { constructor() { throw Error('cache setup failure'); } } } });
  assert.deepEqual(await broken.readPublicProducts(async () => [publicProduct]), [publicProduct]);
  await broken.invalidateProductCache();
  const fill = loadTs('lib/product-cache.ts', { '@upstash/redis': { Redis: class { async eval(script) { if (script.includes('cache:read')) return { token: 'epoch', payload: false, deadline: 60000 }; throw Error('fill unavailable'); } } } });
  assert.deepEqual(await fill.readPublicProducts(async () => [publicProduct]), [publicProduct]);
});
