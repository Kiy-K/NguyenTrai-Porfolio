// Restore omitted fields from retained Lighthouse reports, never invent or rerun historical measurements.
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const { networkEntry } = require('./matched-metrics.cjs');
const [primary, animation, results] = process.argv.slice(2);
assert.ok(primary && animation && results, 'Pass primary raw directory, animation raw directory and results directory');
const restored = [];
for (const [phase, rawRoot] of [['primary', primary], ['animation-off', animation]]) {
  for (const revision of ['baseline', 'release']) {
    const dir = path.join(results, revision + (phase === 'primary' ? '' : '-animation-off'));
    for (const filename of fs.readdirSync(dir).filter(name => name.endsWith('.json'))) {
      const file = path.join(dir, filename), record = JSON.parse(fs.readFileSync(file, 'utf8'));
      const raw = fs.readFileSync(path.join(rawRoot, revision, filename.replace('.json', '.lhr.json.gz')));
      const lhr = JSON.parse(gunzipSync(raw));
      assert.equal(record.metrics['total-blocking-time'], lhr.audits['total-blocking-time'].numericValue);
      assert.equal(record.metrics['largest-contentful-paint'], lhr.audits['largest-contentful-paint'].numericValue);
      assert.deepEqual(record.scores, Object.fromEntries(Object.entries(lhr.categories).map(([key, value]) => [key, value.score])));
      assert.equal(record.lighthouseVersion, lhr.lighthouseVersion);
      const network = lhr.audits['network-requests'].details.items.map(networkEntry);
      assert.equal(network.length, record.network.length);
      for (let i = 0; i < network.length; i++) {
        for (const key of ['url', 'resourceType', 'transferSize', 'resourceSize', 'statusCode']) assert.equal(network[i][key], record.network[i][key]);
      }
      record.network = network;
      record.networkTimingUnit = 'milliseconds since navigation start';
      record.animation = phase === 'primary' ? 'on' : 'off';
      record.evidenceEnrichment = {
        source: `${phase}/${revision}/${filename.replace('.json', '.lhr.json.gz')}`,
        sourceGzipSha256: createHash('sha256').update(raw).digest('hex'),
        timingSource: 'Original Lighthouse 13.5 network-requests audit, networkRequestTime/networkEndTime',
        animationSource: phase === 'primary' ? 'Derived from frozen collector 2fec060: animation ablation did not yet exist' : 'Originally recorded animation=off',
        unchanged: 'observedAt, revision, nodeVersion, metrics, scores and task diagnostics',
      };
      fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
      restored.push({ file: path.relative(results, file), ...record.evidenceEnrichment });
    }
  }
}
assert.equal(restored.length, 38);
fs.writeFileSync(path.join(results, 'restoration-manifest.json'), JSON.stringify(restored, null, 2) + '\n');
console.log(`Restored original network timings and explicit phase provenance for ${restored.length} retained samples`);
