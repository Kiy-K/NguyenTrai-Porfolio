const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextResponse } = require('next/server');
const loadTs = require('./load-ts.cjs');

const env = { ...process.env };

function suggestTitlePost({ session, allowed }) {
  let providerCalls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { providerCalls++; throw new Error('provider must not be called'); };
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  const post = loadTs('app/api/suggest-title/route.ts', {
    'next/server': { NextResponse },
    '@/lib/braintrust': { traceLLMCall: async () => { throw new Error('provider must not be called'); } },
    '@/lib/admin-auth': { getClientIpFromHeaders: () => 'test-ip', getActiveAdminSession: async () => session },
    '@/lib/rate-limit': { consumeRateLimit: async () => ({ allowed, retryAfterSeconds: 30 }) },
    '@/lib/request-security': loadTs('lib/request-security.ts'),
  }).POST;
  const request = new Request('https://test.invalid/api/suggest-title', {
    method: 'POST',
    headers: { origin: 'https://test.invalid', 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Nguyễn Trãi', section: 'Tư tưởng nhân nghĩa' }),
  });
  return { run: () => post(request), providerCalls: () => providerCalls, restore: () => { globalThis.fetch = realFetch; process.env = { ...env }; } };
}

test('suggest-title rejects requests without an admin session before any provider call', async () => {
  const harness = suggestTitlePost({ session: null, allowed: true });
  try {
    const response = await harness.run();
    assert.equal(response.status, 401);
    assert.equal(harness.providerCalls(), 0);
  } finally { harness.restore(); }
});

test('suggest-title rate-limits admin requests before any provider call', async () => {
  const harness = suggestTitlePost({ session: { sessionId: 'test' }, allowed: false });
  try {
    const response = await harness.run();
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '30');
    assert.equal(harness.providerCalls(), 0);
  } finally { harness.restore(); }
});
