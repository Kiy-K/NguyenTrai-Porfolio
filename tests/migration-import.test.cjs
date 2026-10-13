const { test } = require('node:test');
const assert = require('node:assert/strict');
const tools = require('../scripts/migrate-neon.cjs');

const fixture = () => ({ version: 1, content: { products: [{ id: 'retain', videos: [{ muxPlaybackId: 'original-reference' }] }] }, credentials: { passwordHash: 'a'.repeat(64), createdAt: 'original' }, feedback: [{ sourceKey: 'feedback:record:one', payload: { id: 'one', nameHash: 'hashed-name', text: 'sanitized', createdAtUnix: '123' } }] });

test('canonical digests preserve payloads and ignore object-key order', () => {
  assert.equal(tools.digest({ a: 1, b: { c: 2 } }), tools.digest({ b: { c: 2 }, a: 1 }));
  assert.notEqual(tools.digest({ products: [1, 2] }), tools.digest({ products: [2, 1] }));
  const snapshot = fixture(); assert.deepEqual(tools.validateSnapshot(snapshot), snapshot);
});

test('snapshot validation rejects raw identity fields, duplicate keys and malformed payloads', () => {
  for (const mutate of [
    s => { s.feedback[0].payload.email = 'raw@example.test'; },
    s => { s.feedback.push(s.feedback[0]); },
    s => { s.content.products = {}; },
    s => { s.credentials.passwordHash = 'invalid'; },
    s => { s.feedback[0].payload.createdAtUnix = 'NaN'; },
    s => { s.feedback[0].sourceKey = 'feedback:dedupe:one'; },
  ]) { const snapshot = fixture(); mutate(snapshot); assert.throws(() => tools.validateSnapshot(snapshot)); }
});

test('inventory follows SCAN pages, deduplicates keys and excludes temporary state', async () => {
  let cursorCalls = [];
  const hashes = { 'admin:credentials:v1': fixture().credentials, 'feedback:old': { id: 'old', text: 'legacy', createdAtUnix: '12' }, 'feedback:record:one': fixture().feedback[0].payload };
  const redis = {
    scan: async cursor => { cursorCalls.push(cursor); return cursor === '0' ? ['9', ['portfolio_data_v4', 'admin:credentials:v1', 'feedback:old', 'admin:session:temporary', 'feedback_idx_v1']] : ['0', ['feedback:record:one', 'feedback:old']]; },
    ttl: async key => key.startsWith('admin:session:') ? 60 : -1,
    type: async key => key === 'feedback_idx_v1' ? 'search' : key === 'portfolio_data_v4' ? 'string' : 'hash',
    get: async () => fixture().content, hgetall: async key => hashes[key],
  };
  const snapshot = await tools.collectSnapshot(redis);
  assert.deepEqual(cursorCalls, ['0', '9']);
  assert.equal(snapshot.feedback.length, 2);
  assert.deepEqual(snapshot.credentials, fixture().credentials);
  assert.deepEqual(snapshot.content, fixture().content);
});

test('inventory stops on unknown permanent keys instead of dropping data', async () => {
  const redis = { scan: async () => ['0', ['unknown:persistent']], ttl: async () => -1, type: async () => 'string' };
  await assert.rejects(tools.collectSnapshot(redis), /unknown persistent/i);
});

test('import uses one locked transaction and propagates conflict failure', async () => {
  const commands = [];
  const sql = (parts, ...params) => ({ text: parts.join('?'), params });
  sql.query = text => ({ text });
  sql.transaction = async queries => { commands.push(...queries); throw new Error('destination conflict'); };
  await assert.rejects(tools.importSnapshot(sql, fixture()), /destination conflict/);
  assert.match(commands[0].text, /LOCK TABLE/);
  assert.match(commands[1].text, /IS DISTINCT FROM/);
  assert.match(commands[2].text, /ON CONFLICT.*DO NOTHING/s);
  assert.match(commands[3].text, /ON CONFLICT.*DO NOTHING/s);
  assert.ok(commands.every(q => !/TRUNCATE|DELETE FROM|DO UPDATE/i.test(q.text)));
});

test('export/import pause verification requires the production guard marker', async () => {
  const calls = [];
  const paused = async (url, options) => { calls.push({ url, options }); return new Response('{}', { status: 503, headers: { 'X-Data-Write-Paused': '1' } }); };
  await tools.verifyWritePause('https://app.test', paused);
  assert.equal(calls[0].url, 'https://app.test/api/admin/auth/bootstrap');
  assert.equal(calls[0].options.headers.Origin, 'https://app.test');
  assert.equal(calls[0].options.redirect, 'error');
  for (const status of [200, 403, 503]) await assert.rejects(tools.verifyWritePause('https://app.test', async () => new Response('{}', { status })), /write pause/i);
  await assert.rejects(tools.verifyWritePause('http://app.test', paused), /HTTPS/i);
});

test('protected backups cannot resolve inside the repository, including through symlinks', () => {
  const fs = require('node:fs'); const path = require('node:path');
  assert.throws(() => tools.protectedBackupPath(path.join(process.cwd(), 'snapshot.json')), /outside/i);
  const temporary = fs.mkdtempSync('/tmp/neon-backup-test-');
  try {
    fs.symlinkSync(process.cwd(), path.join(temporary, 'repo'));
    assert.throws(() => tools.protectedBackupPath(path.join(temporary, 'repo', 'snapshot.json')), /outside/i);
    const outside = '/var/tmp/neon-backup-unwritten/snapshot.json';
    assert.equal(tools.protectedBackupPath(outside), outside);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('destination pins the endpoint and database and rejects schema ownership collisions', async () => {
  const url = 'postgresql://owner:password@ep-production.neon.tech/neondb';
  assert.equal(tools.destinationFingerprint(url), tools.destinationFingerprint(url.replace('ep-production.', 'ep-production-pooler.')));
  assert.notEqual(tools.destinationFingerprint(url), tools.destinationFingerprint(url.replace('ep-production', 'ep-other')));
  const sql = () => Promise.resolve([{ database: 'neondb', role: 'owner' }]);
  await assert.rejects(tools.verifyDestination(sql, url, 'ep-other.neon.tech/neondb'), /destination/i);
  let calls = 0;
  const ownedByOther = () => Promise.resolve(++calls === 1 ? [{ database: 'neondb', role: 'owner' }] : [{ owner: 'other-owner' }]);
  await assert.rejects(tools.verifyDestination(ownedByOther, url, 'ep-production.neon.tech/neondb'), /ownership/i);
});

test('production PostgreSQL builds fail closed without a separate least-privilege APP_DATABASE_URL', () => {
  const owner = 'postgresql://neondb_owner:o@ep-production-pooler.neon.tech/neondb';
  const app = 'postgresql://portfolio_app:a@ep-production-pooler.neon.tech/neondb';
  const production = { VERCEL_ENV: 'production', PERSISTENCE_BACKEND: 'postgres', DATABASE_URL: owner };
  assert.throws(() => tools.runtimeIdentity(production), /APP_DATABASE_URL/);
  assert.throws(() => tools.runtimeIdentity({ ...production, APP_DATABASE_URL: owner }), /owner role/);
  assert.throws(() => tools.runtimeIdentity({ ...production, DATABASE_URL: undefined, APP_DATABASE_URL: app }), /owner DATABASE_URL/);
  for (const elsewhere of [app.replace('ep-production', 'ep-other'), app.replace('/neondb', '/otherdb')]) {
    assert.throws(() => tools.runtimeIdentity({ ...production, APP_DATABASE_URL: elsewhere }), /same database/);
  }
  const identity = tools.runtimeIdentity({ ...production, APP_DATABASE_URL: app });
  assert.equal(identity.databaseRole, 'portfolio_app');
  assert.equal(identity.neonTargetFingerprint, tools.destinationFingerprint(owner));
  // Previews, Redis production and local builds keep working without the role.
  assert.equal(tools.runtimeIdentity({ ...production, VERCEL_ENV: 'preview' }).databaseRole, 'neondb_owner');
  assert.equal(tools.runtimeIdentity({ ...production, PERSISTENCE_BACKEND: 'redis' }).persistenceBackend, 'redis');
  assert.equal(tools.runtimeIdentity({}).neonTargetFingerprint, 'unconfigured');
});

// Definitions as reported by PostgreSQL 18 for scripts/neon-schema.sql.
const schemaIndexes = [
  { table: 'state', name: 'state_pkey', def: 'CREATE UNIQUE INDEX state_pkey ON portfolio.state USING btree (key)' },
  { table: 'feedback', name: 'feedback_pkey', def: 'CREATE UNIQUE INDEX feedback_pkey ON portfolio.feedback USING btree (source_key)' },
  { table: 'feedback', name: 'feedback_newest', def: 'CREATE INDEX feedback_newest ON portfolio.feedback USING btree (created_at_unix DESC)' },
];
const schemaConstraints = [
  { table: 'state', name: 'state_pkey', def: 'PRIMARY KEY (key)' },
  { table: 'state', name: 'state_key_check', def: "CHECK ((key = ANY (ARRAY['portfolio_data_v4'::text, 'admin:credentials:v1'::text])))" },
  { table: 'state', name: 'state_payload_check', def: "CHECK ((jsonb_typeof(payload) = 'object'::text))" },
  { table: 'feedback', name: 'feedback_pkey', def: 'PRIMARY KEY (source_key)' },
  { table: 'feedback', name: 'feedback_payload_check', def: "CHECK ((jsonb_typeof(payload) = 'object'::text))" },
  { table: 'feedback', name: 'feedback_created_at_unix_check', def: 'CHECK ((created_at_unix >= 0))' },
];

function existingSchema({ indexes = schemaIndexes, constraints = schemaConstraints } = {}) {
  return async (parts) => {
    const text = parts.join('?');
    if (text.includes('current_database()')) return [{ database: 'neondb', role: 'owner' }];
    if (text.includes('FROM pg_namespace')) return [{ owner: 'owner' }];
    if (text.includes('c.relkind')) return ['state', 'feedback'].map(name => ({ name, kind: 'r', owner: 'owner' }))
      .concat(['state_pkey', 'feedback_pkey', 'feedback_newest'].map(name => ({ name, kind: 'i', owner: 'owner' })));
    if (text.includes('information_schema.columns')) return [
      ['feedback', 'source_key', 'text'], ['feedback', 'payload', 'jsonb'], ['feedback', 'created_at_unix', 'int8'],
      ['state', 'key', 'text'], ['state', 'payload', 'jsonb'],
    ].map(([table_name, column_name, udt_name]) => ({ table_name, column_name, udt_name, is_nullable: 'NO' }));
    if (text.includes("'PRIMARY KEY'")) return [{ table_name: 'feedback', column_name: 'source_key' }, { table_name: 'state', column_name: 'key' }];
    if (text.includes('pg_proc')) return [{ count: '0' }];
    if (text.includes('pg_indexes')) return indexes;
    if (text.includes('pg_constraint')) return constraints;
    throw new Error(`Unexpected query: ${text}`);
  };
}

test('destination verification compares index and constraint definitions, not just names', async () => {
  const url = 'postgresql://owner:password@ep-production.neon.tech/neondb';
  const pin = 'ep-production.neon.tech/neondb';
  assert.equal((await tools.verifyDestination(existingSchema(), url, pin)).schemaExists, true);
  const withIndex = def => schemaIndexes.map(index => index.name === 'feedback_newest' ? { ...index, def } : index);
  for (const altered of [
    { indexes: withIndex('CREATE UNIQUE INDEX feedback_newest ON portfolio.feedback USING btree (created_at_unix DESC)') },
    { indexes: withIndex('CREATE INDEX feedback_newest ON portfolio.feedback USING btree (created_at_unix DESC) WHERE (created_at_unix > 0)') },
    { indexes: withIndex('CREATE INDEX feedback_newest ON portfolio.feedback USING btree (source_key)') },
    { constraints: schemaConstraints.concat({ table: 'feedback', name: 'feedback_reject', def: 'CHECK (false)' }) },
    { constraints: schemaConstraints.filter(constraint => constraint.name !== 'state_key_check') },
  ]) {
    await assert.rejects(tools.verifyDestination(existingSchema(altered), url, pin), /definition/i);
  }
});
