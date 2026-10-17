const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { digest, payloadDigest } = require('../scripts/migrate-neon.cjs');
const recovery = require('../scripts/reconcile-redis.cjs');
const fixture = () => ({ version: 1, content: { products: [{ id: 'one', images: ['cloudinary/original'], videos: [{ muxPlaybackId: 'keep' }] }] }, credentials: { passwordHash: 'a'.repeat(64), createdAt: 'original' }, feedback: [{ sourceKey: 'feedback:record:one', payload: { id: 'one', nameHash: 'hash', text: 'safe', createdAtUnix: '123' } }] });
const identity = { neon: 'neon-fingerprint', redis: 'redis.test', origin: 'https://app.test' };
function setup() {
  const before = fixture();
  const source = fixture(); source.credentials.passwordHash = 'b'.repeat(64);
  source.content.products.push({ id: 'two', video: 'legacy-video' });
  source.feedback.push({ sourceKey: 'feedback:record:two', payload: { id: 'two', createdAtUnix: '124' } });
  let current = structuredClone(before), writes = 0, pauses = 0, failure = -1;
  const plan = recovery.createPlan(source, before, identity);
  const options = { plan, readNeon: async () => structuredClone(source), readRedis: async () => structuredClone(current), verifyPause: async () => { pauses++; },
    cas: async record => {
      writes++;
      if (writes === failure) throw Error('connection lost');
      if (record.key === 'portfolio_data_v4') current.content = structuredClone(record.after);
      else if (record.key === 'admin:credentials:v1') current.credentials = structuredClone(record.after);
      else { const index = current.feedback.findIndex(r => r.sourceKey === record.key); const row = { sourceKey: record.key, payload: structuredClone(record.after) }; if (index < 0) current.feedback.push(row); else current.feedback[index] = row; }
    },
  };
  return { before, source, plan, options, current: () => current, writes: () => writes, pauses: () => pauses, failAt: n => { failure = n; } };
}

test('default is read-only and canonical digests include IDs, media and credential hashes', async () => {
  const s = setup();
  const result = await recovery.reconcile(s.options);
  assert.equal(s.writes(), 0); assert.equal(s.pauses(), 0); assert.equal(result.pending, 3);
  assert.equal(s.plan.approval, digest(s.plan.body));
  for (const mutate of [x => { x.content.products[0].id = 'changed'; }, x => { x.content.products[0].videos[0].muxPlaybackId = 'changed'; }, x => { x.credentials.passwordHash = 'c'.repeat(64); }]) {
    const copy = structuredClone(s.source); mutate(copy); assert.notEqual(payloadDigest(copy), payloadDigest(s.source));
  }
});

test('feedback conflicts, duplicate product IDs and removed credential fields fail closed', () => {
  const s = setup();
  const conflicting = fixture(); conflicting.feedback[0].payload.text = 'different';
  assert.throws(() => recovery.createPlan(s.source, conflicting, identity), /conflict/i);
  const duplicate = fixture(); duplicate.content.products.push(duplicate.content.products[0]);
  assert.throws(() => recovery.createPlan(duplicate, fixture(), identity), /ID/i);
  const extra = fixture(); extra.credentials.passwordSalt = 'old';
  assert.throws(() => recovery.createPlan(s.source, extra, identity), /field/i);
});

test('destination-only feedback is preserved and verified in the union', async () => {
  const s = setup(); s.before.feedback.push({ sourceKey: 'feedback:old', payload: { id: 'old', createdAtUnix: '1' } });
  const plan = recovery.createPlan(s.source, s.before, identity);
  assert.equal(plan.body.expected.feedback.length, 3);
  assert.deepEqual(plan.body.expected.feedback.find(row => row.sourceKey === 'feedback:old'), s.before.feedback.at(-1));
});

test('apply requires exact approval, live pause and unchanged source before writes', async () => {
  for (const mode of ['approval', 'pause', 'source', 'tamper']) {
    const s = setup(); const options = { ...s.options, apply: true, approval: s.plan.approval };
    if (mode === 'approval') options.approval = 'wrong';
    if (mode === 'pause') options.verifyPause = async () => { throw Error('pause absent'); };
    if (mode === 'source') s.source.content.products = [];
    if (mode === 'tamper') options.plan.body.expected.content.products = [];
    const expected = { approval: /explicit approval/i, pause: /pause absent/, source: /source changed/i, tamper: /digest verification/i };
    await assert.rejects(recovery.reconcile(options), expected[mode]); assert.equal(s.writes(), 0);
  }
});

test('unexpected destination changes fail before mutation', async () => {
  const s = setup(); s.current().credentials.createdAt = 'unexpected';
  await assert.rejects(recovery.reconcile({ ...s.options, apply: true, approval: s.plan.approval }), /conflict/i);
  assert.equal(s.writes(), 0);
});

test('partial failure retries finish safely and repeated application is idempotent', async () => {
  const s = setup(); const options = { ...s.options, apply: true, approval: s.plan.approval };
  s.failAt(2); await assert.rejects(recovery.reconcile(options), /connection/);
  assert.notEqual(payloadDigest(s.current()), payloadDigest(s.source));
  s.failAt(-1); const result = await recovery.reconcile(options);
  assert.equal(result.verified, true); assert.equal(payloadDigest(s.current()), payloadDigest(s.source));
  const writes = s.writes(); await recovery.reconcile(options); assert.equal(s.writes(), writes);
  assert.ok(s.pauses() >= 3);
});

test('lost successful response can be retried; verification catches corruption and moving sources', async () => {
  const s = setup(); const original = s.options.cas; let lost = true;
  const options = { ...s.options, apply: true, approval: s.plan.approval, cas: async r => { await original(r); if (lost) { lost = false; throw Error('lost response'); } } };
  await assert.rejects(recovery.reconcile(options), /lost response/);
  assert.equal((await recovery.reconcile(options)).verified, true);
  const corrupt = setup();
  await assert.rejects(recovery.reconcile({ ...corrupt.options, apply: true, approval: corrupt.plan.approval, cas: async () => {} }), /verification/i);
  const moving = setup(); const write = moving.options.cas;
  await assert.rejects(recovery.reconcile({ ...moving.options, apply: true, approval: moving.plan.approval, cas: async r => { await write(r); moving.source.content.products = []; } }), /source/i);
});

test('backup creates exclusive private files and refuses Git paths, tampering and unsafe permissions', () => {
  const s = setup(); const directory = fs.mkdtempSync('/var/tmp/rollback-private-'); fs.chmodSync(directory, 0o700);
  const file = path.join(directory, 'plan.json');
  try {
    recovery.writeBackup(file, s.plan);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.deepEqual(recovery.readBackup(file), s.plan);
    assert.throws(() => recovery.writeBackup(file, s.plan));
    fs.chmodSync(file, 0o644); assert.throws(() => recovery.readBackup(file), /private|permission/i);
    assert.throws(() => recovery.writeBackup(path.join(process.cwd(), 'bad.json'), s.plan), /outside/i);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('raw Redis compare-and-set detects concurrent changes without touching transient keys', async () => {
  const s = setup();
  let wire = JSON.stringify(s.before.content), evals = 0;
  const raw = { get: async () => wire, eval: async (_script, keys, args) => {
    evals++; assert.deepEqual(keys, ['portfolio_data_v4']); assert.equal(JSON.parse(args[1]), wire);
    wire = JSON.parse(args[2]); return 1;
  } };
  const record = { key: 'portfolio_data_v4', type: 'string', before: s.before.content, after: s.source.content };
  await recovery.redisCas(raw, record); assert.equal(evals, 1);
  await recovery.redisCas(raw, record); assert.equal(evals, 1);
  wire = JSON.stringify({ products: [] }); await assert.rejects(recovery.redisCas(raw, record), /conflict/i);
});

test('Neon collection uses a read-only consistent snapshot and rejects extra state', async () => {
  const s = setup();
  const sql = () => ({});
  let extra = false;
  sql.transaction = async (_queries, options) => {
    assert.deepEqual(options, { readOnly: true, isolationLevel: 'RepeatableRead' });
    return [[{ key: 'portfolio_data_v4', payload: s.source.content }, { key: 'admin:credentials:v1', payload: s.source.credentials }, ...(extra ? [{ key: 'unknown', payload: {} }] : [])], s.source.feedback.map(r => ({ source_key: r.sourceKey, payload: r.payload, created_at_unix: Number(r.payload.createdAtUnix) }))];
  };
  assert.equal(payloadDigest(await recovery.collectNeon(sql)), payloadDigest(s.source));
  extra = true; await assert.rejects(recovery.collectNeon(sql), /state/i);
});

test('empty Neon feedback hashes fail at planning before any writes', () => {
  const s = setup(); s.source.feedback.push({ sourceKey: 'feedback:record:empty', payload: {} });
  assert.throws(() => recovery.createPlan(s.source, s.before, identity), /empty/i);
});


test('final verification refuses an absent pause before reading either store', async () => {
  const s = setup(); let reads = 0;
  await assert.rejects(recovery.verifyReconciliation({
    plan: s.plan, readNeon: async () => { reads++; return s.source; },
    readRedis: async () => { reads++; return s.plan.body.expected; },
    verifyPause: async () => { throw Error('pause absent'); },
  }), /pause absent/);
  assert.equal(reads, 0);
});

test('final verification rejects a pause lifted during either store read', async () => {
  for (const phase of ['neon', 'redis']) {
    const s = setup(); let paused = true;
    await assert.rejects(recovery.verifyReconciliation({
      plan: s.plan,
      readNeon: async () => { if (phase === 'neon') paused = false; return s.source; },
      readRedis: async () => { if (phase === 'redis') paused = false; return s.plan.body.expected; },
      verifyPause: async () => { if (!paused) throw Error('pause lifted'); },
    }), /pause lifted/);
  }
});

test('apply cannot report success if its pause is lifted in the final Redis read', async () => {
  const s = setup(); let paused = true;
  await assert.rejects(recovery.reconcile({
    ...s.options, apply: true, approval: s.plan.approval,
    readRedis: async () => { if (s.writes() === 3) paused = false; return structuredClone(s.current()); },
    verifyPause: async () => { if (!paused) throw Error('pause lifted'); },
  }), /pause lifted/);
});

test('a complete paused verification checks both guards and returns verified digests', async () => {
  const s = setup(); let checks = 0;
  const result = await recovery.verifyReconciliation({
    plan: s.plan, readNeon: async () => s.source, readRedis: async () => s.plan.body.expected,
    verifyPause: async () => { checks++; },
  });
  assert.equal(checks, 2); assert.equal(result.verified, true); assert.equal(result.expected.digest, payloadDigest(s.plan.body.expected));
});

test('planning rejects missing or noncanonical production origins before exporting a plan', () => {
  const s = setup();
  for (const origin of [undefined, '', 'http://app.test', 'https://app.test/path', 'https://user:secret@app.test', 'https://app.test/?query=1']) {
    assert.throws(() => recovery.createPlan(s.source, s.before, { ...identity, origin }), /MIGRATION_APP_URL/);
  }
});

test('standalone verify requires the pause and checks it again after both reads', () => {
  const { spawnSync } = require('node:child_process');
  const { destinationFingerprint } = require('../scripts/migrate-neon.cjs');
  const directory = fs.mkdtempSync('/var/tmp/rollback-cli-'); fs.chmodSync(directory, 0o700);
  const file = path.join(directory, 'plan.json');
  const url = 'postgresql://synthetic:synthetic@neon.test/db';
  const s = setup();
  const plan = recovery.createPlan(s.source, s.before, { ...identity, neon: destinationFingerprint(url) });
  try {
    recovery.writeBackup(file, plan);
    for (const mode of ['absent', 'lifted', 'paused']) {
      const result = spawnSync(process.execPath, ['--require', path.resolve('tests/helpers/rollback-cli-preload.cjs'),
        path.resolve('scripts/reconcile-redis.cjs'), 'verify', file, 'neon.test/db', 'redis.test'], {
        encoding: 'utf8', timeout: 10000,
        env: { ...process.env, DATABASE_URL: url, UPSTASH_REDIS_REST_URL: 'https://redis.test',
          MIGRATION_APP_URL: identity.origin, DATA_WRITE_PAUSED: mode === 'absent' ? '0' : '1',
          ROLLBACK_CLI_FIXTURE: file, ROLLBACK_CLI_PAUSE_LOST: mode === 'lifted' ? '1' : '0' },
      });
      const events = JSON.parse(fs.readFileSync(path.join(directory, 'trace.json'), 'utf8'));
      assert.equal(result.status, mode === 'paused' ? 0 : 1, result.stderr);
      if (mode === 'absent') { assert.match(result.stderr, /DATA_WRITE_PAUSED=1/); assert.deepEqual(events, []); }
      else assert.deepEqual(events, ['pause', 'neon', 'redis', 'pause']);
      if (mode === 'paused') assert.equal(JSON.parse(result.stdout).verified, true);
      else assert.equal(result.stdout.includes('"verified":true'), false);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
