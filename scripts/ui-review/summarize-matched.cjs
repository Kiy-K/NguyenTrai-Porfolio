const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.argv[2];
assert.ok(root, 'Pass matrix output directory');
const median = values => { const v = [...values].sort((a, b) => a - b); return (v[Math.floor((v.length - 1) / 2)] + v[Math.ceil((v.length - 1) / 2)]) / 2; };
const stats = values => { assert.ok(values.every(Number.isFinite)); return { median: median(values), min: Math.min(...values), max: Math.max(...values) }; };
assert.deepEqual(stats([3, 1, 2]), { median: 2, min: 1, max: 3 });
assert.equal(median([1, 3]), 2);
if (process.argv[3] === 'animation-off') {
  const summary = {};
  for (const revision of ['baseline', 'release']) {
    const runs = Array.from({ length: 5 }, (_, i) => JSON.parse(fs.readFileSync(path.join(root, revision, `mobile-widget-off-${i + 1}.json`))));
    assert.ok(runs.every(r => r.animation === 'off' && r.nodeVersion === 'v24.21.0' && !r.widgetRendered));
    summary[revision] = { lcp: stats(runs.map(r => r.metrics['largest-contentful-paint'])), tbt: stats(runs.map(r => r.metrics['total-blocking-time'])), score: stats(runs.map(r => r.scores.performance * 100)) };
  }
  fs.writeFileSync(path.join(root, 'animation-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  return;
}
assert.ok(!process.argv[3], 'Only animation-off is supported');
const groups = {};
const sums = {};
for (const revision of ['baseline', 'release']) for (const profile of ['mobile', 'desktop']) for (const widget of ['on', 'off']) {
  const runs = Array.from({ length: profile === 'mobile' ? 5 : 2 }, (_, i) => JSON.parse(fs.readFileSync(path.join(root, revision, `${profile}-widget-${widget}-${i + 1}.json`))));
  assert.ok(runs.every(r => r.nodeVersion === 'v24.21.0' && r.lighthouseVersion === '13.5.0' && r.widgetRendered === (widget === 'on')));
  groups[`${revision}/${profile}/${widget}`] = runs;
  const items = (r, key) => r.diagnostics[key]?.details?.items || [];
  const total = (r, key, field, accept = () => true) => items(r, key).filter(accept).reduce((sum, x) => sum + (x[field] || 0), 0);
  sums[`${revision}/${profile}/${widget}`] = {
    samples: runs.length,
    tbt: stats(runs.map(r => r.metrics['total-blocking-time'])),
    lcp: stats(runs.map(r => r.metrics['largest-contentful-paint'])),
    score: stats(runs.map(r => r.scores.performance * 100)),
    cls: stats(runs.map(r => r.metrics['cumulative-layout-shift'])),
    execution: stats(runs.map(r => total(r, 'bootup-time', 'scripting'))),
    parse: stats(runs.map(r => total(r, 'bootup-time', 'scriptParseCompile'))),
    firstPartyExecution: stats(runs.map(r => total(r, 'bootup-time', 'scripting', x => x.url?.startsWith('http://127.0.0.1:3330/')))),
    widgetExecution: stats(runs.map(r => total(r, 'bootup-time', 'scripting', x => x.url?.includes('unpkg.com/')))),
    longTaskDuration: stats(runs.map(r => total(r, 'long-tasks', 'duration'))),
    jsTransferBytes: stats(runs.map(r => r.network.filter(x => x.resourceType === 'Script').reduce((s, x) => s + x.transferSize, 0))),
    jsResourceBytes: stats(runs.map(r => r.network.filter(x => x.resourceType === 'Script').reduce((s, x) => s + x.resourceSize, 0))),
    unusedJsBytes: stats(runs.map(r => total(r, 'unused-javascript', 'wastedBytes'))),
    load1: stats(runs.map(r => r.platform.loadBefore[0])),
  };
}
const all = Object.values(groups).flat();
assert.equal(new Set(all.map(r => r.assetManifestSha256)).size, 1);
assert.equal(new Set(all.map(r => r.browser)).size, 1);
for (const profile of ['mobile', 'desktop']) {
  assert.equal(new Set(all.filter(r => r.profile === profile).map(r => JSON.stringify({ throttle: r.settings.throttling, method: r.settings.throttlingMethod, screen: r.settings.screenEmulation, blocked: r.settings.blockedUrlPatterns }))).size, 1);
}
const before = groups['baseline/mobile/off'], after = groups['release/mobile/off'];
const pairedTbtDeltas = after.map((r, i) => r.metrics['total-blocking-time'] - before[i].metrics['total-blocking-time']);
const baselineTbt = sums['baseline/mobile/off'].tbt.median;
const delta = sums['release/mobile/off'].tbt.median - baselineTbt;
const firstPartyThresholdTriggered = delta > 100 && delta > baselineTbt * 0.2 && pairedTbtDeltas.filter(x => x > 0).length >= 4;
const pairedMetricDeltas = {};
const boot = (r, field) => (r.diagnostics['bootup-time']?.details?.items || []).reduce((s, x) => s + (x[field] || 0), 0);
const measures = {
  tbt: r => r.metrics['total-blocking-time'], lcp: r => r.metrics['largest-contentful-paint'], score: r => r.scores.performance * 100,
  execution: r => boot(r, 'scripting'), parse: r => boot(r, 'scriptParseCompile'),
  jsTransferBytes: r => r.network.filter(x => x.resourceType === 'Script').reduce((s, x) => s + x.transferSize, 0),
  jsResourceBytes: r => r.network.filter(x => x.resourceType === 'Script').reduce((s, x) => s + x.resourceSize, 0),
  unusedJsBytes: r => (r.diagnostics['unused-javascript']?.details?.items || []).reduce((s, x) => s + (x.wastedBytes || 0), 0),
};
for (const profile of ['mobile', 'desktop']) for (const widget of ['on', 'off']) {
  const a = groups[`baseline/${profile}/${widget}`], b = groups[`release/${profile}/${widget}`];
  pairedMetricDeltas[`${profile}/${widget}`] = Object.fromEntries(Object.entries(measures).map(([key, value]) => [key, b.map((r, i) => value(r) - value(a[i]))]));
}
const report = { pairedMetricDeltas, observedAt: new Date().toISOString(), harnessRevision: '2fec060', summaries: sums,
  pairedWidgetOffTbtDeltas: pairedTbtDeltas, firstPartyThresholdTriggered,
  note: 'Threshold is preregistered diagnostic evidence, not statistical proof. See traces, widget-on interaction and scope limits before concluding.' };
fs.writeFileSync(path.join(root, 'summary.json'), JSON.stringify(report, null, 2));
for (const [key, value] of Object.entries(sums)) console.log(key, JSON.stringify(value));
console.log('firstPartyThresholdTriggered', firstPartyThresholdTriggered, 'paired deltas', pairedTbtDeltas);
