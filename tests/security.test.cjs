const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const loadTs = require('./load-ts.cjs');
const { NextResponse } = require('next/server');

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });
const ownerToken = 'test-owner-token-'.repeat(4);

function authWith(redis) {
  const persistence = loadTs('lib/persistence.ts', { '@/lib/redis': { redis }, '@neondatabase/serverless': { neon: () => { throw new Error('Unexpected PostgreSQL access'); } } });
  return loadTs('lib/admin-auth.ts', {
    '@/lib/persistence': persistence, '@/lib/redis': { redis }, 'next/headers': { cookies: async () => ({ get: () => undefined }) },
  });
}
function bootstrapRoute(redis) {
  return loadTs('app/api/admin/auth/bootstrap/route.ts', {
    'next/server': { NextResponse }, '@/lib/admin-auth': authWith(redis),
    '@/lib/rate-limit': { consumeRateLimit: async () => ({ allowed: true }) },
    '@/lib/request-security': loadTs('lib/request-security.ts'),
  }).POST;
}
function request(token, origin = 'https://test.invalid') {
  return new Request('https://test.invalid/api/admin/auth/bootstrap', {
    method: 'POST', headers: { ...(origin && { origin }), ...(token && { 'x-admin-bootstrap-token': token }) },
  });
}

for (const [name, configured, supplied] of [
  ['disabled', '', ownerToken], ['missing token', ownerToken, ''],
  ['wrong token', ownerToken, 'wrong'], ['short configuration', 'short', 'short'],
]) {
  test(`bootstrap rejects ${name} before Redis access`, async () => {
    process.env.ADMIN_BOOTSTRAP_TOKEN = configured;
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
    const redis = new Proxy({}, { get: () => () => { throw new Error('Redis must not be touched'); } });
    const res = await bootstrapRoute(redis)(request(supplied));
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal((await res.json()).password, undefined);
  });
}

test('bootstrap retains same-origin validation', async () => {
  process.env.ADMIN_BOOTSTRAP_TOKEN = ownerToken;
  const post = bootstrapRoute({});
  for (const origin of ['', 'https://attacker.invalid']) assert.equal((await post(request(ownerToken, origin))).status, 403);
});

// This fixture models the single atomic Redis command; live Lua execution is a separate integration prerequisite.
function memoryRedis(initial) {
  let record = initial;
  return {
    hgetall: async () => record,
    hset: async (_key, fields) => { record = { ...record, ...fields }; },
    eval: async (script, keys, args) => {
      assert.match(script, /redis.call\('EXISTS', KEYS\[1\]\)/);
      assert.match(script, /redis.call\('HSET', KEYS\[1\]/);
      assert.deepEqual(keys, ['admin:credentials:v1']);
      if (record) return 0;
      record = Object.fromEntries(Array.from({ length: args.length / 2 }, (_, i) => [args[i * 2], args[i * 2 + 1]]));
      return 1;
    },
    record: () => record,
  };
}

test('concurrent owner provisioning returns one password and preserves the winner', async () => {
  process.env.ADMIN_BOOTSTRAP_TOKEN = ownerToken;
  process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
  const redis = memoryRedis();
  const post = bootstrapRoute(redis);
  const responses = await Promise.all(Array.from({ length: 4 }, () => post(request(ownerToken))));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409, 409, 409]);
  const bodies = await Promise.all(responses.map(r => r.json()));
  const passwords = bodies.filter(b => b.password).map(b => b.password);
  assert.equal(passwords.length, 1);
  assert.equal(redis.record().passwordScheme, 'pbkdf2-v1');
  assert.notEqual(redis.record().passwordHash, passwords[0]);
  assert.equal(await authWith(redis).verifyAdminPassword(passwords[0]), true);
  assert.equal(await authWith(redis).verifyAdminPassword('incorrect'), false);
});

for (const initial of [
  { passwordHash: createHash('sha256').update('existing-password').digest('hex'), createdAt: 'original' },
  { passwordSalt: 'partial-record-must-not-be-overwritten' },
]) {
  test(`provisioning preserves existing ${initial.passwordHash ? 'legacy credentials' : 'partial records'}`, async () => {
    const redis = memoryRedis(initial);
    const result = await authWith(redis).bootstrapAdminCredentials();
    assert.equal(result.created, false);
    assert.equal(result.password, null);
    assert.deepEqual(redis.record(), initial);
    if (initial.passwordHash) {
      assert.equal(await authWith(redis).verifyAdminPassword('existing-password'), true);
      assert.equal(redis.record().createdAt, 'original');
      assert.equal(await authWith(redis).verifyAdminPassword('existing-password'), true);
    }
  });
}

test('provisioning storage failure never returns a generated password', async (t) => {
  t.mock.method(console, 'error', () => {});
  process.env.ADMIN_BOOTSTRAP_TOKEN = ownerToken;
  process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
  const redis = { hgetall: async () => null, eval: async () => { throw new Error('test storage failure'); }, hset: async () => { throw new Error('test storage failure'); } };
  const res = await bootstrapRoute(redis)(request(ownerToken));
  assert.equal(res.status, 500);
  assert.equal((await res.json()).password, undefined);
});

test('redirects allow local admin paths and reject unsafe destinations', () => {
  const { safeAdminRedirect } = loadTs('lib/admin-redirect.ts');
  for (const value of ['/admin', '/admin/', '/admin/feedback?sort=recent#top']) assert.equal(safeAdminRedirect(value), value);
  for (const value of [null, '', '//evil.test', 'https://evil.test/admin', 'javascript:alert(1)', 'data:text/html,x', '/administrator', '/products/1', '/admin/../products', '/admin/%2e%2e/products', '/admin/%252e%252e/products', '/admin/\\evil', '/admin/%5cevil', '/admin/%2f/evil', '/admin\n/evil', '/admin/login?next=javascript:alert(1)', ' /admin']) assert.equal(safeAdminRedirect(value), '/admin', String(value));
});

test('existing administrator login still issues a secure session cookie', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
  process.env.NODE_ENV = 'production';
  process.env.ADMIN_AUTH_PEPPER = 'test-pepper';
  process.env.FEEDBACK_HASH_PEPPER = 'test-feedback-pepper';
  const credentials = { passwordHash: createHash('sha256').update('existing-password').digest('hex'), createdAt: 'original' };
  const redis = memoryRedis(credentials);
  const auth = authWith(redis);
  const post = loadTs('app/api/admin/auth/login/route.ts', {
    'next/server': { NextResponse },
    '@/lib/admin-auth': { ...auth, createAdminSession: async () => ({ sessionId: 'test-session', expiresAt: 'test-expiry' }) },
    '@/lib/rate-limit': { consumeRateLimit: async () => ({ allowed: true }) },
    '@/lib/request-security': loadTs('lib/request-security.ts'),
  }).POST;
  const loginRequest = (password) => new Request('https://test.invalid/api/admin/auth/login', {
    method: 'POST', headers: { origin: 'https://test.invalid', 'content-type': 'application/json' }, body: JSON.stringify({ password }),
  });
  assert.equal((await post(loginRequest('wrong-password'))).status, 401);
  const res = await post(loginRequest('existing-password'));
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie');
  for (const flag of ['admin_session=test-session', 'HttpOnly', 'Secure', 'SameSite=strict', 'Max-Age=10800']) assert.ok(cookie.includes(flag), cookie);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('both login page navigation callbacks validate the next parameter', async (t) => {
  const effects = [];
  const navigations = [];
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ success: true }) }));
  let stateIndex = 0;
  const page = loadTs('app/admin/login/page.tsx', {
    react: {
      useEffect: (callback) => effects.push(callback),
      useState: (initial) => [stateIndex++ === 0 ? 'existing-password' : initial, () => {}],
    },
    'next/navigation': { useRouter: () => ({ replace: value => navigations.push(value) }), useSearchParams: () => new URLSearchParams('next=javascript:alert(1)') },
    '@/lib/admin-redirect': loadTs('lib/admin-redirect.ts'),
  }).default;
  const tree = page();
  effects.forEach(callback => callback());
  await new Promise(resolve => setImmediate(resolve));
  function findForm(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'form') return node;
    for (const child of [node.props?.children].flat()) { const found = findForm(child); if (found) return found; }
  }
  await findForm(tree).props.onSubmit({ preventDefault() {} });
  assert.deepEqual(navigations, ['/admin', '/admin']);
});


test('existing IP-bound administrator sessions remain valid', async () => {
  process.env.ADMIN_AUTH_PEPPER = 'test-pepper';
  const id = '11111111-1111-4111-8111-111111111111';
  const ip = '192.0.2.10';
  const ipHash = authWith({}).hashIp(ip);
  const session = { sessionId: id, ipHash, expiresAtUnix: String(Date.now() + 60000) };
  const auth = loadTs('lib/admin-auth.ts', {
    '@/lib/persistence': {}, '@/lib/redis': { redis: { hgetall: async () => session } },
    'next/headers': { cookies: async () => ({ get: () => ({ value: id }) }) },
  });
  assert.equal((await auth.getActiveAdminSession(ip)).sessionId, id);
  assert.equal(await auth.getActiveAdminSession('192.0.2.11'), null);
});

test('legacy password recheck does not mutate credentials during the write pause', async () => {
  process.env.DATA_WRITE_PAUSED = '1';
  const original = { passwordHash: createHash('sha256').update('existing-password').digest('hex'), createdAt: 'original' };
  const redis = memoryRedis(original);
  assert.equal(await authWith(redis).verifyAdminPassword('existing-password'), true);
  assert.deepEqual(redis.record(), original);
  assert.equal(await authWith(redis).verifyAdminPassword('incorrect'), false);
});
