const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

class MigrationError extends Error {}
const fail = message => { throw new MigrationError(message); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = value => JSON.stringify(value, (_key, item) => isObject(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const orderedFeedback = rows => [...rows].sort((a, b) => a.sourceKey < b.sourceKey ? -1 : a.sourceKey > b.sourceKey ? 1 : 0);
const payloadDigest = snapshot => digest({ version: 1, content: snapshot.content, credentials: snapshot.credentials, feedback: orderedFeedback(snapshot.feedback) });
const feedbackKey = key => key.startsWith('feedback:record:') && key.length > 'feedback:record:'.length || /^feedback:[^:]+$/.test(key);
const timestamp = payload => Number(payload.createdAtUnix || 0);

function validateSnapshot(snapshot) {
  if (snapshot?.version !== 1 || !isObject(snapshot.content) || !Array.isArray(snapshot.content.products)) fail('Invalid content snapshot');
  const credentials = snapshot.credentials;
  if (!isObject(credentials) || !/^(?:[a-f0-9]{64}|[a-f0-9]{128})$/i.test(credentials.passwordHash || '')) fail('Invalid credential snapshot');
  if (credentials.passwordScheme === 'pbkdf2-v1' && (!/^[a-f0-9]{128}$/i.test(credentials.passwordHash) || !/^[a-f0-9]{32}$/i.test(credentials.passwordSalt || ''))) fail('Invalid salted credential snapshot');
  if (!Array.isArray(snapshot.feedback)) fail('Invalid feedback snapshot');
  const seen = new Set();
  for (const row of snapshot.feedback) {
    if (!isObject(row) || typeof row.sourceKey !== 'string' || !feedbackKey(row.sourceKey) || seen.has(row.sourceKey) || !isObject(row.payload)) fail('Invalid or duplicate feedback key');
    seen.add(row.sourceKey);
    if (Object.keys(row.payload).some(key => /^(name|class|email)$/i.test(key) && row.payload[key])) fail('Raw feedback identity fields require separate review');
    if (!Number.isSafeInteger(timestamp(row.payload)) || timestamp(row.payload) < 0) fail('Invalid feedback timestamp');
  }
  return snapshot;
}

async function collectSnapshot(redis) {
  let cursor = '0';
  const seen = new Set();
  const snapshot = { version: 1, content: null, credentials: null, feedback: [] };
  let unknown = 0;
  do {
    const [next, keys] = await redis.scan(cursor, { count: 100 });
    cursor = String(next);
    for (const key of keys) {
      if (seen.has(key)) continue;
      seen.add(key);
      const ttl = await redis.ttl(key);
      if (ttl !== -1) continue;
      const type = await redis.type(key);
      if (type === 'none' || key === 'feedback_idx_v1' && type === 'search') continue;
      if (key === 'portfolio_data_v4' && type === 'string') snapshot.content = await redis.get(key);
      else if (key === 'admin:credentials:v1' && type === 'hash') snapshot.credentials = await redis.hgetall(key);
      else if (feedbackKey(key) && type === 'hash') snapshot.feedback.push({ sourceKey: key, payload: await redis.hgetall(key) });
      else unknown++;
    }
  } while (cursor !== '0');
  if (unknown) fail(`Unknown persistent records require review (count: ${unknown})`);
  snapshot.feedback = orderedFeedback(snapshot.feedback);
  return validateSnapshot(snapshot);
}

function stateRows(snapshot) {
  return [{ key: 'portfolio_data_v4', payload: snapshot.content }, { key: 'admin:credentials:v1', payload: snapshot.credentials }];
}
function feedbackRows(snapshot) {
  return snapshot.feedback.map(row => ({ source_key: row.sourceKey, payload: row.payload, created_at_unix: timestamp(row.payload) }));
}

async function importSnapshot(sql, snapshot) {
  validateSnapshot(snapshot);
  const states = JSON.stringify(stateRows(snapshot));
  const feedback = JSON.stringify(feedbackRows(snapshot));
  // A conflicting existing row aborts the entire locked transaction, including all inserts.
  await sql.transaction([
    sql.query('LOCK TABLE portfolio.state, portfolio.feedback IN EXCLUSIVE MODE'),
    sql`SELECT 1 / CASE WHEN
      EXISTS (SELECT 1 FROM jsonb_to_recordset(${states}::jsonb) AS incoming(key text, payload jsonb)
        JOIN portfolio.state stored USING (key) WHERE stored.payload IS DISTINCT FROM incoming.payload)
      OR EXISTS (SELECT 1 FROM jsonb_to_recordset(${feedback}::jsonb) AS incoming(source_key text, payload jsonb, created_at_unix bigint)
        JOIN portfolio.feedback stored USING (source_key) WHERE stored.payload IS DISTINCT FROM incoming.payload OR stored.created_at_unix <> incoming.created_at_unix)
      OR EXISTS (SELECT 1 FROM portfolio.state WHERE key NOT IN (SELECT key FROM jsonb_to_recordset(${states}::jsonb) AS incoming(key text, payload jsonb)))
      OR EXISTS (SELECT 1 FROM portfolio.feedback WHERE source_key NOT IN (SELECT source_key FROM jsonb_to_recordset(${feedback}::jsonb) AS incoming(source_key text, payload jsonb, created_at_unix bigint)))
      THEN 0 ELSE 1 END AS destination_verified`,
    sql`INSERT INTO portfolio.state (key, payload)
      SELECT key, payload FROM jsonb_to_recordset(${states}::jsonb) AS incoming(key text, payload jsonb)
      ON CONFLICT (key) DO NOTHING`,
    sql`INSERT INTO portfolio.feedback (source_key, payload, created_at_unix)
      SELECT source_key, payload, created_at_unix FROM jsonb_to_recordset(${feedback}::jsonb) AS incoming(source_key text, payload jsonb, created_at_unix bigint)
      ON CONFLICT (source_key) DO NOTHING`,
  ]);
}

async function verifySnapshot(sql, snapshot) {
  validateSnapshot(snapshot);
  const [states, feedback] = await sql.transaction([
    sql`SELECT key, payload FROM portfolio.state ORDER BY key`,
    sql`SELECT source_key, payload, created_at_unix FROM portfolio.feedback ORDER BY source_key`,
  ], { readOnly: true, isolationLevel: 'RepeatableRead' });
  if (states.length !== 2) fail('Destination state count mismatch');
  for (const row of feedback) if (Number(row.created_at_unix) !== timestamp(row.payload)) fail('Destination timestamp mismatch');
  const actual = { version: 1, content: states.find(row => row.key === 'portfolio_data_v4')?.payload,
    credentials: states.find(row => row.key === 'admin:credentials:v1')?.payload,
    feedback: feedback.map(row => ({ sourceKey: row.source_key, payload: row.payload })) };
  if (payloadDigest(actual) !== payloadDigest(snapshot)) fail('Destination payload verification failed');
  return { verified: true, digest: payloadDigest(actual), products: actual.content.products.length, feedback: actual.feedback.length };
}

async function verifyWritePause(appUrl, fetchRequest = fetch) {
  let url;
  try { url = new URL(appUrl); } catch { fail('MIGRATION_APP_URL must identify the production HTTPS origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail('MIGRATION_APP_URL must identify the production HTTPS origin');
  const response = await fetchRequest(`${url.origin}/api/admin/auth/bootstrap`, {
    method: 'POST', headers: { Origin: url.origin }, redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  if (response.status !== 503 || response.headers.get('x-data-write-paused') !== '1') fail('Production write pause is not verified');
}

function protectedBackupPath(file) {
  const repository = fs.realpathSync(path.join(__dirname, '..'));
  const absolute = path.resolve(file);
  let ancestor = absolute;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const resolved = path.join(fs.realpathSync(ancestor), path.relative(ancestor, absolute));
  if (resolved === repository || resolved.startsWith(repository + path.sep)) fail('Protected backups must stay outside the repository');
  for (let directory = path.dirname(resolved); ; directory = path.dirname(directory)) {
    if (fs.existsSync(path.join(directory, '.git'))) fail('Protected backups must stay outside Git repositories');
    if (directory === path.dirname(directory)) break;
  }
  return resolved;
}

function destinationFingerprint(databaseUrl) {
  let url;
  try { url = new URL(databaseUrl); } catch { fail('A usable PostgreSQL connection URL is required'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) fail('A usable PostgreSQL connection URL is required');
  // Pooled and direct URLs identify the same Neon endpoint.
  return digest(`${url.hostname.replace(/-pooler(?=\.)/, '')}/${decodeURIComponent(url.pathname.slice(1))}`);
}

// scripts/neon-schema.sql as rendered by pg_indexes/pg_get_constraintdef (PostgreSQL 18). Fails closed if the format differs.
const EXPECTED_DEFINITIONS = {
  state: {
    indexes: { state_pkey: 'CREATE UNIQUE INDEX state_pkey ON portfolio.state USING btree (key)' },
    constraints: {
      state_pkey: 'PRIMARY KEY (key)',
      state_key_check: "CHECK ((key = ANY (ARRAY['portfolio_data_v4'::text, 'admin:credentials:v1'::text])))",
      state_payload_check: "CHECK ((jsonb_typeof(payload) = 'object'::text))",
    },
  },
  feedback: {
    indexes: {
      feedback_pkey: 'CREATE UNIQUE INDEX feedback_pkey ON portfolio.feedback USING btree (source_key)',
      feedback_newest: 'CREATE INDEX feedback_newest ON portfolio.feedback USING btree (created_at_unix DESC)',
    },
    constraints: {
      feedback_pkey: 'PRIMARY KEY (source_key)',
      feedback_payload_check: "CHECK ((jsonb_typeof(payload) = 'object'::text))",
      feedback_created_at_unix_check: 'CHECK ((created_at_unix >= 0))',
    },
  },
};

async function verifyDestination(sql, databaseUrl, expectedDestination) {
  const url = new URL(databaseUrl);
  const identity = `${url.hostname}/${decodeURIComponent(url.pathname.slice(1))}`;
  if (identity !== expectedDestination) fail('Destination endpoint/database identity mismatch');
  const [target] = await sql`SELECT current_database() AS database, current_user AS role`;
  if (target.database !== decodeURIComponent(url.pathname.slice(1))) fail('Destination database identity mismatch');
  const schemas = await sql`SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname = 'portfolio'`;
  if (!schemas.length) return { fingerprint: destinationFingerprint(databaseUrl), schemaExists: false };
  if (schemas[0].owner !== target.role) fail('Destination schema ownership mismatch');
  const objects = await sql`SELECT c.relname AS name, c.relkind AS kind, pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'portfolio'`;
  const allowed = { state: 'r', feedback: 'r', state_pkey: 'i', feedback_pkey: 'i', feedback_newest: 'i' };
  if (objects.some(object => allowed[object.name] !== object.kind || object.owner !== target.role)) fail('Unexpected destination schema objects or ownership');
  const columns = await sql`SELECT table_name, column_name, udt_name, is_nullable
    FROM information_schema.columns WHERE table_schema = 'portfolio' ORDER BY table_name, ordinal_position`;
  const expected = {
    state: [['key', 'text', 'NO'], ['payload', 'jsonb', 'NO']],
    feedback: [['source_key', 'text', 'NO'], ['payload', 'jsonb', 'NO'], ['created_at_unix', 'int8', 'NO']],
  };
  for (const table of ['state', 'feedback']) {
    if (!objects.some(object => object.name === table)) continue;
    const actual = columns.filter(column => column.table_name === table).map(column => [column.column_name, column.udt_name, column.is_nullable]);
    if (canonical(actual) !== canonical(expected[table])) fail('Destination table structure mismatch');
  }
  const primaryKeys = await sql`SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
    WHERE tc.table_schema = 'portfolio' AND tc.constraint_type = 'PRIMARY KEY' ORDER BY tc.table_name, kcu.ordinal_position`;
  for (const [table, key] of [['state', 'key'], ['feedback', 'source_key']]) {
    if (!objects.some(object => object.name === table)) continue;
    const keys = primaryKeys.filter(row => row.table_name === table).map(row => row.column_name);
    if (canonical(keys) !== canonical([key])) fail('Destination primary key structure mismatch');
  }
  const [custom] = await sql`SELECT
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'portfolio') +
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'portfolio' AND NOT t.tgisinternal) AS count`;
  if (Number(custom.count)) fail('Unexpected destination functions or triggers');
  // Names alone would accept a UNIQUE/partial feedback_newest or an extra CHECK that rejects imported rows.
  const indexes = await sql`SELECT tablename AS table, indexname AS name, indexdef AS def FROM pg_indexes WHERE schemaname = 'portfolio'`;
  const constraints = await sql`SELECT c.relname AS table, k.conname AS name, pg_get_constraintdef(k.oid) AS def
    FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid WHERE k.connamespace = 'portfolio'::regnamespace AND k.contype <> 'n'`;
  for (const table of ['state', 'feedback']) {
    if (!objects.some(object => object.name === table)) continue;
    const definitions = rows => Object.fromEntries(rows.filter(row => row.table === table).map(row => [row.name, row.def]));
    if (canonical(definitions(indexes)) !== canonical(EXPECTED_DEFINITIONS[table].indexes) ||
        canonical(definitions(constraints)) !== canonical(EXPECTED_DEFINITIONS[table].constraints)) {
      fail('Destination index or constraint definition mismatch (compare with scripts/neon-schema.sql)');
    }
  }
  return { fingerprint: destinationFingerprint(databaseUrl), schemaExists: true };
}

// Same URL choice as lib/persistence.ts; the role name is logged so each build shows its privilege level.
function runtimeIdentity(env) {
  const persistenceBackend = env.PERSISTENCE_BACKEND || 'redis';
  // Fail the build, not requests: a rejected build leaves the current deployment serving.
  if (env.VERCEL_ENV === 'production' && persistenceBackend === 'postgres') {
    if (!env.APP_DATABASE_URL) fail('Production PostgreSQL builds require APP_DATABASE_URL (least-privilege role); refusing the owner DATABASE_URL');
    if (env.DATABASE_URL && new URL(env.APP_DATABASE_URL).username === new URL(env.DATABASE_URL).username) fail('APP_DATABASE_URL must not use the owner role');
  }
  const runtimeUrl = env.APP_DATABASE_URL || env.DATABASE_URL;
  return { persistenceBackend, neonTargetFingerprint: runtimeUrl ? destinationFingerprint(runtimeUrl) : 'unconfigured', databaseRole: runtimeUrl ? decodeURIComponent(new URL(runtimeUrl).username) : 'unconfigured' };
}

async function main() {
  const [command, inputFile, expectedDestination] = process.argv.slice(2);
  if (!['identity', 'inventory', 'export', 'import', 'verify'].includes(command)) fail('Usage: identity | inventory | export <outside-Git-file> | import/verify <outside-Git-file> <expected-host/database>');
  const env = require('@next/env');
  const log = { info() {}, error() {} };
  env.loadEnvConfig(process.cwd(), false, log);
  const developmentFile = path.join(process.cwd(), '.env.development.local');
  if (fs.existsSync(developmentFile)) env.processEnv([{ path: developmentFile, contents: fs.readFileSync(developmentFile, 'utf8'), env: {} }], process.cwd(), log, true);
  if (command === 'identity') {
    console.log(JSON.stringify(runtimeIdentity(process.env)));
    return;
  }
  const file = inputFile ? protectedBackupPath(inputFile) : null;
  const redis = require('@upstash/redis').Redis.fromEnv();
  if (command === 'inventory' || command === 'export') {
    if (command === 'export') {
      if (process.env.DATA_WRITE_PAUSED !== '1') fail('Export requires a verified production write pause');
      await verifyWritePause(process.env.MIGRATION_APP_URL);
    }
    const snapshot = await collectSnapshot(redis);
    const sourceHost = new URL(process.env.UPSTASH_REDIS_REST_URL).hostname;
    if (command === 'export') {
      if (!file) fail('A protected backup file is required');
      const second = await collectSnapshot(redis);
      if (payloadDigest(snapshot) !== payloadDigest(second)) fail('Source changed during export; keep writes paused and investigate');
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      const directory = fs.statSync(path.dirname(file));
      if ((directory.mode & 0o077) !== 0 || process.getuid && directory.uid !== process.getuid()) fail('Backup parent directory must be private and owned by the operator');
      fs.writeFileSync(file, JSON.stringify({ ...snapshot, sourceHost, exportedAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
    }
    console.log(JSON.stringify({ sourceHost, products: snapshot.content.products.length, feedback: snapshot.feedback.length, credentialRecord: true, digest: payloadDigest(snapshot), backupWritten: command === 'export' }));
    return;
  }
  if (!file || !expectedDestination) fail('Backup file and expected destination endpoint/database are required');
  if ((fs.statSync(file).mode & 0o077) !== 0) fail('Backup permissions must be 0600 or stricter');
  const snapshot = validateSnapshot(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (snapshot.sourceHost !== new URL(process.env.UPSTASH_REDIS_REST_URL).hostname) fail('Backup source does not match configured Redis');
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(?:ql)?:\/\//.test(url)) fail('A usable DATABASE_URL is required');
  const sql = require('@neondatabase/serverless').neon(url);
  await verifyDestination(sql, url, expectedDestination);
  if (command === 'import') {
    if (process.env.DATA_WRITE_PAUSED !== '1') fail('Import requires a verified production write pause');
    await verifyWritePause(process.env.MIGRATION_APP_URL);
    const current = await collectSnapshot(redis);
    if (payloadDigest(current) !== payloadDigest(snapshot)) fail('Backup no longer matches the source; keep writes paused');
    const schema = fs.readFileSync(path.join(__dirname, 'neon-schema.sql'), 'utf8').split(';').map(part => part.trim()).filter(Boolean);
    await sql.transaction(schema.map(statement => sql.query(statement)));
    await importSnapshot(sql, snapshot);
  }
  console.log(JSON.stringify(await verifySnapshot(sql, snapshot)));
}

module.exports = { protectedBackupPath, destinationFingerprint, runtimeIdentity, verifyDestination, verifyWritePause, canonical, digest, payloadDigest, validateSnapshot, collectSnapshot, importSnapshot, verifySnapshot };
if (require.main === module) main().catch(error => {
  console.error(error instanceof MigrationError ? error.message : `Migration failed (${error.name || 'UnknownError'}); details suppressed to protect data and secrets.`);
  process.exitCode = 1;
});
