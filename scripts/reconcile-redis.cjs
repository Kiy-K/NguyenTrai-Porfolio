const fs = require('node:fs');
const path = require('node:path');
const migration = require('./migrate-neon.cjs');
const { canonical, digest, payloadDigest, validateSnapshot, protectedBackupPath } = migration;
class RecoveryError extends Error {}
const fail = message => { throw new RecoveryError(message); };
const same = (a, b) => canonical(a) === canonical(b);
const CONTENT = 'portfolio_data_v4';
const CREDENTIALS = 'admin:credentials:v1';

function normalize(snapshot) {
  const result = structuredClone(validateSnapshot(snapshot));
  const hash = value => {
    if (!Object.keys(value).length) fail('Empty hash payload requires owner recovery');
    return Object.fromEntries(Object.entries(value).map(([key, field]) => {
    if (!['string', 'number', 'boolean'].includes(typeof field)) fail('Hash fields must be scalar values');
    return [key, String(field)];
    }));
  };
  result.credentials = hash(result.credentials);
  result.feedback = result.feedback.map(row => ({ sourceKey: row.sourceKey, payload: hash(row.payload) })).sort((a, b) => a.sourceKey.localeCompare(b.sourceKey, 'en'));
  const ids = new Set();
  for (const product of result.content.products) {
    if (!product || !['string', 'number'].includes(typeof product.id) || String(product.id).length === 0 || typeof product.id === 'number' && !Number.isSafeInteger(product.id) || ids.has(String(product.id))) fail('Invalid or duplicate product ID');
    ids.add(String(product.id));
  }
  return result;
}
function records(snapshot) {
  return [{ key: CONTENT, type: 'string', value: snapshot.content }, { key: CREDENTIALS, type: 'hash', value: snapshot.credentials },
    ...snapshot.feedback.map(row => ({ key: row.sourceKey, type: 'hash', value: row.payload }))];
}
function createPlan(neon, redis, identity) {
  neon = normalize(neon); redis = normalize(redis);
  const feedback = new Map(redis.feedback.map(row => [row.sourceKey, row]));
  for (const row of neon.feedback) {
    if (feedback.has(row.sourceKey) && !same(feedback.get(row.sourceKey), row)) fail('Feedback conflict requires owner recovery');
    feedback.set(row.sourceKey, row);
  }
  for (const key of Object.keys(redis.credentials)) if (!Object.hasOwn(neon.credentials, key)) fail('Credential field removal requires owner recovery');
  const expected = normalize({ ...neon, feedback: [...feedback.values()] });
  const body = { version: 1, identity, neon, redis, expected };
  return { body, approval: digest(body) };
}
function validatePlan(plan) {
  if (plan?.body?.version !== 1 || !plan.body.identity || plan.approval !== digest(plan.body)) fail('Backup digest verification failed');
  const rebuilt = createPlan(plan.body.neon, plan.body.redis, plan.body.identity);
  if (!same(rebuilt, plan)) fail('Backup plan verification failed');
  return plan;
}
function pendingRecords(plan, current) {
  const before = new Map(records(plan.body.redis).map(row => [row.key, row.value]));
  const wanted = records(plan.body.expected);
  const actual = new Map(records(normalize(current)).map(row => [row.key, row.value]));
  if ([...actual.keys()].some(key => !wanted.some(row => row.key === key))) fail('Unexpected destination record conflict');
  return wanted.flatMap(row => {
    const value = actual.get(row.key);
    if (same(value, row.value)) return [];
    if (!same(value, before.get(row.key))) fail('Destination conflict; keep writes paused');
    return [{ key: row.key, type: row.type, before: value, after: row.value }];
  });
}
async function reconcile({ plan, readNeon, readRedis, cas, verifyPause, apply = false, approval }) {
  validatePlan(plan);
  if (apply) {
    if (approval !== plan.approval) fail('Explicit approval of the exact plan digest is required');
    await verifyPause();
  }
  const checkSource = async () => {
    if (!same(normalize(await readNeon()), plan.body.neon)) fail('Neon source changed; export a new plan');
  };
  await checkSource();
  const pending = pendingRecords(plan, await readRedis());
  if (!apply) return { dryRun: true, pending: pending.length, approval: plan.approval, ...summary(plan.body) };
  for (const record of pending) {
    await verifyPause();
    await checkSource();
    await cas(record);
  }
  await verifyPause();
  await checkSource();
  const actual = normalize(await readRedis());
  if (!same(actual, plan.body.expected)) fail('Redis verification failed; keep writes paused and retry');
  return { verified: true, applied: pending.length, approval: plan.approval, ...summary(plan.body) };
}
function summary(body) {
  const report = snapshot => ({ digest: payloadDigest(snapshot), products: snapshot.content.products.length, feedback: snapshot.feedback.length,
    contentDigest: digest(snapshot.content), feedbackDigest: digest(snapshot.feedback), feedbackIdsDigest: digest(snapshot.feedback.map(r => ({ key: r.sourceKey, id: r.payload.id }))),
    credentialsDigest: digest(snapshot.credentials), idsDigest: digest(snapshot.content.products.map(p => p.id)),
    mediaDigest: digest(snapshot.content.products.map(({ id, images, video, videos, muxAssetId, muxPlaybackId }) => ({ id, images, video, videos, muxAssetId, muxPlaybackId }))) });
  return { neon: report(body.neon), redisBefore: report(body.redis), expected: report(body.expected), identity: body.identity };
}
function privatePath(file) {
  const resolved = protectedBackupPath(file);
  const directory = fs.statSync(path.dirname(resolved));
  if ((directory.mode & 0o077) || process.getuid && directory.uid !== process.getuid()) fail('Backup directory must be private and operator-owned');
  return resolved;
}
function writeBackup(file, plan) {
  validatePlan(plan);
  const resolved = privatePath(file);
  const fd = fs.openSync(resolved, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(plan)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function readBackup(file) {
  const resolved = privatePath(file);
  const fd = fs.openSync(resolved, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.mode & 0o077 || process.getuid && stat.uid !== process.getuid()) fail('Backup permissions must be private and operator-owned');
    return validatePlan(JSON.parse(fs.readFileSync(fd, 'utf8')));
  } finally { fs.closeSync(fd); }
}
async function collectNeon(sql) {
  const [states, feedback] = await sql.transaction([
    sql`SELECT key, payload FROM portfolio.state ORDER BY key`,
    sql`SELECT source_key, payload, created_at_unix FROM portfolio.feedback ORDER BY source_key`,
  ], { readOnly: true, isolationLevel: 'RepeatableRead' });
  if (states.length !== 2 || new Set(states.map(row => row.key)).size !== 2 || states.some(row => ![CONTENT, CREDENTIALS].includes(row.key))) fail('Unexpected Neon state records');
  for (const row of feedback) if (Number(row.created_at_unix) !== Number(row.payload.createdAtUnix || 0)) fail('Neon timestamp mismatch');
  return normalize({ version: 1, content: states.find(row => row.key === CONTENT)?.payload, credentials: states.find(row => row.key === CREDENTIALS)?.payload,
    feedback: feedback.map(row => ({ sourceKey: row.source_key, payload: row.payload })) });
}
// Compare exact wire values atomically. Validate every field before HSET: Lua errors do not undo earlier writes.
const CAS = `
local kind = redis.call('TYPE', KEYS[1]).ok
local expected = cjson.decode(ARGV[2])
local desired = cjson.decode(ARGV[3])
if kind ~= 'none' and kind ~= ARGV[1] then return 0 end
if kind ~= 'none' and redis.call('TTL', KEYS[1]) ~= -1 then return 0 end
if ARGV[1] == 'string' then
  if redis.call('GET', KEYS[1]) ~= expected then return 0 end
  redis.call('SET', KEYS[1], desired)
else
  local current = redis.call('HGETALL', KEYS[1])
  local count = 0
  for k,v in pairs(expected) do
    if redis.call('HGET', KEYS[1], k) ~= v then return 0 end
    count = count + 1
  end
  if #current ~= count * 2 then return 0 end
  for k,v in pairs(expected) do if desired[k] == nil then return 0 end end
  for k,v in pairs(desired) do if type(v) ~= 'string' then return 0 end end
  for k,v in pairs(desired) do redis.call('HSET', KEYS[1], k, v) end
end
return 1`;
function rawAdapter(redis) {
  return { scan: (...args) => redis.scan(...args), ttl: key => redis.ttl(key), type: key => redis.type(key),
    get: async key => { const value = await redis.get(key); return value === null ? null : JSON.parse(value); },
    hgetall: async key => { const fields = await redis.hgetall(key); return Object.fromEntries(Array.from({ length: fields.length / 2 }, (_, i) => fields.slice(i * 2, i * 2 + 2))); } };
}
async function redisCas(redis, record) {
  const raw = record.type === 'string' ? await redis.get(record.key) : await rawAdapter(redis).hgetall(record.key);
  const value = record.type === 'string' ? raw === null ? undefined : JSON.parse(raw) : Object.keys(raw).length ? raw : undefined;
  if (same(value, record.after)) return;
  if (!same(value, record.before)) fail('Concurrent Redis record conflict');
  const expected = record.type === 'string' ? raw : raw || {};
  const desired = record.type === 'string' ? JSON.stringify(record.after) : record.after;
  if (await redis.eval(CAS, [record.key], [record.type, JSON.stringify(expected), JSON.stringify(desired)]) !== 1) fail('Atomic Redis comparison failed');
}
async function main() {
  const [command = 'dry-run', file, expectedNeon, expectedRedis, approval, ...extra] = process.argv.slice(2);
  if (!['dry-run', 'apply', 'verify'].includes(command) || !file || !expectedNeon || !expectedRedis || extra.length || command !== 'apply' && approval) fail('Usage: dry-run|verify <private-file> <neon-host/database> <redis-host> | apply <private-file> <neon-host/database> <redis-host> <approval-digest>');
  // Deliberately use only the process environment; never auto-load production/local credentials.
  const url = process.env.DATABASE_URL;
  if (!url) fail('DATABASE_URL is required');
  const redisUrl = new URL(process.env.UPSTASH_REDIS_REST_URL);
  if (redisUrl.protocol !== 'https:' || redisUrl.hostname !== expectedRedis) fail('Redis endpoint identity mismatch');
  const sql = require('@neondatabase/serverless').neon(url);
  const target = await migration.verifyDestination(sql, url, expectedNeon);
  if (!target.schemaExists) fail('Neon schema is missing');
  const redis = new (require('@upstash/redis').Redis)({ url: redisUrl.origin, token: process.env.UPSTASH_REDIS_REST_TOKEN, automaticDeserialization: false, enableAutoPipelining: false });
  const readNeon = () => collectNeon(sql);
  const readRedis = async () => normalize(await migration.collectSnapshot(rawAdapter(redis)));
  const identity = { neon: migration.destinationFingerprint(url), redis: expectedRedis, origin: process.env.MIGRATION_APP_URL };
  let plan;
  if (command === 'dry-run') {
    const firstNeon = await readNeon(), firstRedis = await readRedis();
    if (!same(firstNeon, await readNeon()) || !same(firstRedis, await readRedis())) fail('Stores changed during export; pause and retry');
    plan = createPlan(firstNeon, firstRedis, identity);
    writeBackup(file, plan);
  } else {
    plan = readBackup(file);
    if (!same(plan.body.identity, identity)) fail('Backup target or production origin mismatch');
  }
  const verifyPause = async () => {
    if (process.env.DATA_WRITE_PAUSED !== '1') fail('Apply requires DATA_WRITE_PAUSED=1 and verified production pause');
    await migration.verifyWritePause(process.env.MIGRATION_APP_URL);
  };
  if (command === 'verify') {
    if (!same(await readNeon(), plan.body.neon) || !same(await readRedis(), plan.body.expected)) fail('Final verification failed');
    console.log(JSON.stringify({ verified: true, approval: plan.approval, ...summary(plan.body) }));
  } else console.log(JSON.stringify(await reconcile({ plan, readNeon, readRedis, cas: record => redisCas(redis, record), verifyPause, apply: command === 'apply', approval })));
}
module.exports = { createPlan, reconcile, writeBackup, readBackup, normalize, collectNeon, redisCas, rawAdapter, CAS };
if (require.main === module) main().catch(error => {
  console.error(error instanceof RecoveryError ? error.message : `Recovery failed (${error.name || 'UnknownError'}); details suppressed; keep writes paused.`);
  process.exitCode = 1;
});
