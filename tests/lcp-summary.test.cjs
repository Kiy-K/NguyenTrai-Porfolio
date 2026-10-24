const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spread, summarize, benefit } = require('../scripts/ui-review/summarize-lcp.cjs');
test('LCP summaries preserve outliers and reject partial or mixed conditions', () => {
  assert.deepEqual(spread([10, 1, 2, 3, 100]), { median: 3, min: 1, max: 100, samples: [10, 1, 2, 3, 100] });
  assert.throws(() => summarize([], 5), /Incomplete cell/);
  const rows = [1, 2].map(sample => ({ sample, nodeVersion: 'v24.22.1' }));
  rows[1].nodeVersion = 'v26';
  assert.throws(() => summarize(rows, 2), /Mixed cell/);
});
test('shipping threshold rejects noise, inconsistent pairs, TBT and CLS regressions', () => {
  const cell = (lcp, tbt = 50, cls = 0) => ({ metrics: {
    'largest-contentful-paint': spread(lcp), 'total-blocking-time': spread([tbt]), 'cumulative-layout-shift': spread([cls]) }, accessibility: spread([1]) });
  const a = cell([2600, 2600, 2600, 2600, 2600]);
  assert.equal(benefit(a, cell([2400, 2400, 2400, 2400, 2400])).passes, true);
  assert.equal(benefit(a, cell([2550, 2550, 2550, 2550, 2550])).passes, false);
  assert.equal(benefit(a, cell([2400, 2400, 2400, 2700, 2700])).passes, false);
  assert.equal(benefit(a, cell([2400, 2400, 2400, 2400, 2400], 101)).passes, false);
  assert.equal(benefit(a, cell([2400, 2400, 2400, 2400, 2400], 50, .01)).passes, false);
});
