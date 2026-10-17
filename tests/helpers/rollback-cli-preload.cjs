// Replace external I/O only; exercise the actual standalone command and protected-file handling.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const migration = require('../../scripts/migrate-neon.cjs');
const plan = JSON.parse(fs.readFileSync(process.env.ROLLBACK_CLI_FIXTURE, 'utf8'));
const events = [];
process.on('exit', () => fs.writeFileSync(path.join(path.dirname(process.env.ROLLBACK_CLI_FIXTURE), 'trace.json'), JSON.stringify(events)));
migration.verifyDestination = async () => ({ schemaExists: true });
migration.collectSnapshot = async () => { events.push('redis'); return plan.body.expected; };
migration.verifyWritePause = async () => {
  events.push('pause');
  if (process.env.ROLLBACK_CLI_PAUSE_LOST === '1' && events.filter(event => event === 'pause').length === 2) throw Error('synthetic pause lost');
};
const sql = () => ({});
sql.transaction = async () => {
  events.push('neon');
  return [[{ key: 'portfolio_data_v4', payload: plan.body.neon.content }, { key: 'admin:credentials:v1', payload: plan.body.neon.credentials }],
    plan.body.neon.feedback.map(row => ({ source_key: row.sourceKey, payload: row.payload, created_at_unix: Number(row.payload.createdAtUnix || 0) }))];
};
const load = Module._load;
Module._load = function(id, ...args) {
  if (id === '@neondatabase/serverless') return { neon: () => sql };
  if (id === '@upstash/redis') return { Redis: class {} };
  return load.call(this, id, ...args);
};
