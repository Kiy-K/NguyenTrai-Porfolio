const { test } = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { getClientIpFromHeaders } = loadTs('lib/admin-auth.ts', {
  'next/headers': { cookies: async () => ({}) },
  '@/lib/redis': { redis: {} },
  '@/lib/persistence': {
    readCredentials: async () => null,
    createCredentials: async () => false,
    updateCredentials: async () => {},
  },
});

test('client IP is the rightmost X-Forwarded-For entry so client-supplied leading entries cannot spoof it', () => {
  assert.equal(getClientIpFromHeaders(new Headers({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' })), '203.0.113.9');
});

test('client IP falls back to x-real-ip, then to unknown', () => {
  assert.equal(getClientIpFromHeaders(new Headers({ 'x-real-ip': '198.51.100.7' })), '198.51.100.7');
  assert.equal(getClientIpFromHeaders(new Headers()), 'unknown');
});
