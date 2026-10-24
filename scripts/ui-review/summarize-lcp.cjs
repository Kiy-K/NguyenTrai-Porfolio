const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function spread(values) {
  assert.ok(values.length && values.every(Number.isFinite));
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return { median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2, min: sorted[0], max: sorted.at(-1), samples: values };
}
function summarize(records, expectedCount) {
  assert.equal(records.length, expectedCount, 'Incomplete cell');
  const identity = r => JSON.stringify([r.nodeVersion, r.revision, r.collectorSourceSha256, r.metricsHelperSha256,
    r.browser, r.tools, r.assetManifestSha256, r.settings, r.widget, r.profile]);
  assert.equal(new Set(records.map(identity)).size, 1, 'Mixed cell conditions');
  assert.deepEqual(records.map(r => r.sample).sort((a, b) => a - b), Array.from({ length: expectedCount }, (_, i) => i + 1));
  const metrics = Object.fromEntries(Object.keys(records[0].metrics).map(key => [key, spread(records.map(r => r.metrics[key]))]));
  const subparts = r => r.diagnostics['lcp-breakdown-insight'].details.items[0].items;
  return { metrics, accessibility: spread(records.map(r => r.scores.accessibility)),
    candidates: records.map(r => r.presentation.candidates),
    observedSubparts: Object.fromEntries(subparts(records[0]).map(s => [s.subpart,
      spread(records.map(r => subparts(r).find(x => x.subpart === s.subpart)?.duration))])) };
}
function benefit(control, variant) {
  const a = control.metrics['largest-contentful-paint'];
  const b = variant.metrics['largest-contentful-paint'];
  const paired = b.samples.map((v, i) => v - a.samples[i]);
  const improvement = a.median - b.median;
  return { pairedLcpDeltas: paired, improvementMs: improvement, improvementPercent: 100 * improvement / a.median,
    passes: improvement >= 100 && improvement >= a.median * 0.05 && paired.filter(x => x < 0).length >= 4
      && variant.metrics['total-blocking-time'].median <= control.metrics['total-blocking-time'].median + 50
      && variant.metrics['cumulative-layout-shift'].max === 0 && variant.accessibility.min >= control.accessibility.min };
}
if (require.main === module) {
  const root = process.argv[2];
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'plan.json')));
  const result = {};
  let experimentIdentity;
  for (const target of plan.targets) {
    result[target.label] = {};
    for (const widget of plan.widgets) for (const profile of ['mobile', 'desktop']) {
      const count = profile === 'mobile' ? 5 : 2;
      const records = Array.from({ length: count }, (_, i) => JSON.parse(fs.readFileSync(path.join(root, target.label, `${profile}-widget-${widget}-${i + 1}.json`))));
      for (const r of records) {
        assert.equal(r.revision, target.revision);
        assert.equal(r.nodeVersion, 'v24.22.1');
        const id = JSON.stringify([r.nodeVersion, r.collectorSourceSha256, r.browser, r.tools, r.assetManifestSha256]);
        experimentIdentity ??= id;
        assert.equal(id, experimentIdentity, 'Mixed experiment tools/assets');
      }
      result[target.label][`${profile}-${widget}`] = summarize(records, count);
    }
  }
  for (const widget of plan.widgets) for (const target of plan.targets.slice(1)) {
    result[target.label][`comparison-${widget}`] = benefit(result[plan.targets[0].label][`mobile-${widget}`], result[target.label][`mobile-${widget}`]);
  }
  fs.writeFileSync(path.join(root, 'summary.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
module.exports = { spread, summarize, benefit };
