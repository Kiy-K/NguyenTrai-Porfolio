const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const loadTs = require('../tests/load-ts.cjs');
const migration = require('./migrate-neon.cjs');

async function main() {
  require('@next/env').loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(?:ql)?:\/\//.test(url)) throw new Error('Usable DATABASE_URL required');
  const sql = require('@neondatabase/serverless').neon(url);
  const namespace = `migration_test_${randomUUID().replaceAll('-', '')}`;
  assert.match(namespace, /^migration_test_[a-f0-9]{32}$/);
  const rewrite = text => text.replace(/\bportfolio\b/g, namespace);
  const testSql = (parts, ...params) => sql.query(rewrite(parts.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '')), params);
  testSql.query = (text, params) => sql.query(rewrite(text), params);
  testSql.transaction = (...args) => sql.transaction(...args);
  process.env.PERSISTENCE_BACKEND = 'postgres';
  const noRedis = new Proxy({}, { get: () => () => { throw new Error('Unexpected Redis access'); } });
  const store = loadTs('lib/persistence.ts', { '@/lib/product-cache': { invalidateProductCache: async () => {} }, '@/lib/redis': { redis: noRedis }, '@neondatabase/serverless': { neon: () => testSql } });
  const auth = loadTs('lib/admin-auth.ts', { '@/lib/redis': { redis: noRedis }, '@/lib/persistence': store, 'next/headers': {} });
  const snapshot = {
    version: 1,
    content: { products: [{ id: 'original', videos: [{ muxPlaybackId: 'unchanged' }] }], metadata: 'retain' },
    credentials: { passwordHash: createHash('sha256').update('synthetic-existing-password').digest('hex'), createdAt: 'original-date' },
    feedback: [
      { sourceKey: 'feedback:record:one', payload: { id: 'one', text: 'modern', nameHash: 'synthetic-hash', createdAtUnix: '123' } },
      { sourceKey: 'feedback:one', payload: { id: 'one', text: 'legacy', nameHash: 'synthetic-hash', createdAtUnix: '456' } },
    ],
  };
  let created = false;
  let check = 'schema setup';
  try {
    await sql.query(`CREATE SCHEMA ${namespace}`); created = true;
    const statements = fs.readFileSync(path.join(__dirname, 'neon-schema.sql'), 'utf8').split(';').map(s => s.trim()).filter(Boolean).slice(1);
    await testSql.transaction(statements.map(statement => testSql.query(statement)));
    check = 'destination ownership and structure';
    const targetUrl = new URL(url);
    await migration.verifyDestination(testSql, url, `${targetUrl.hostname}/${decodeURIComponent(targetUrl.pathname.slice(1))}`);
    check = 'repeatable import and payload equality';
    await migration.importSnapshot(testSql, snapshot);
    await migration.importSnapshot(testSql, snapshot);
    assert.equal((await migration.verifySnapshot(testSql, snapshot)).verified, true);
    check = 'conflict transaction rollback';
    const conflicting = JSON.parse(JSON.stringify(snapshot)); conflicting.content.products[0].id = 'conflict';
    await assert.rejects(migration.importSnapshot(testSql, conflicting), error => error.code === '22012');
    assert.equal((await migration.verifySnapshot(testSql, snapshot)).verified, true);
    check = 'modern feedback precedence over legacy duplicates';
    const feedback = await store.readPostgresFeedback(200);
    assert.equal(feedback.length, 1);
    assert.equal(feedback[0].text, 'modern');
    check = 'concurrent atomic product append and preserved metadata';
    await Promise.all([1, 2, 3].map(id => store.appendProduct({ id: `new-${id}`, images: ['https://example.invalid/unchanged'] })));
    const content = await store.readContent();
    assert.equal(content.products.length, 4); assert.equal(content.metadata, 'retain');
    assert.equal(content.products[0].videos[0].muxPlaybackId, 'unchanged');
    check = 'legacy password verification and credential field preservation';
    assert.equal(await auth.verifyAdminPassword('synthetic-existing-password'), true);
    assert.equal((await store.readCredentials()).createdAt, 'original-date');
    assert.equal(await auth.verifyAdminPassword('synthetic-existing-password'), true);
    check = 'concurrent atomic owner provisioning';
    await testSql.query('DELETE FROM portfolio.state WHERE key = $1', ['admin:credentials:v1']);
    const results = await Promise.all(Array.from({ length: 4 }, () => auth.bootstrapAdminCredentials()));
    const winners = results.filter(result => result.created);
    assert.equal(winners.length, 1);
    assert.equal(await auth.verifyAdminPassword(winners[0].password), true);
    check = 'feedback writes and bounded reads';
    await store.writeFeedback('feedback:record:two', { id: 'two', text: 'synthetic', createdAtUnix: '789', emailHash: 'synthetic-hash' });
    assert.equal((await store.readPostgresFeedback(1)).length, 1);
    check = 'missing content fails without initialization';
    await testSql.query('DELETE FROM portfolio.state WHERE key = $1', ['portfolio_data_v4']);
    await assert.rejects(store.readContent(), /content/i);
    await assert.rejects(store.appendProduct({ id: 'must-not-initialize' }), /content/i);
    console.log(JSON.stringify({ verified: true, checks: 9, database: 'configured Neon target', sourceRedisTouched: false }));
  } catch (error) {
    console.error(`Neon integration check failed: ${check} (${error.name || 'UnknownError'}); details suppressed.`);
    throw error;
  } finally {
    if (created) await sql.query(`DROP SCHEMA ${namespace} CASCADE`);
  }
}

main().catch(() => { process.exitCode = 1; });
