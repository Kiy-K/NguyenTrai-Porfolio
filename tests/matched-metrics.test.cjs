const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { isAdminTraffic, networkEntry, assessRegression } = require('../scripts/ui-review/matched-metrics.cjs');

const sample = (tbt, execution, longTasks) => ({ tbt: { median: tbt }, firstPartyExecution: { median: execution }, firstPartyLongTaskDuration: { median: longTasks } });
test('TBT growth alone cannot trigger first-party regression attribution', () => {
  const result = assessRegression(sample(50, 200, 150), sample(300, 200, 150), [250, 250, 250, 250, 250]);
  assert.equal(result.preliminaryTbtSignal, true);
  assert.equal(result.firstPartyThresholdTriggered, false);
});
test('the full threshold requires numeric growth and first-party execution or task evidence', () => {
  assert.equal(assessRegression(sample(50, 200, 150), sample(300, 250, 150), [250, 250, 250, 250, 250]).firstPartyThresholdTriggered, true);
  assert.equal(assessRegression(sample(50, 200, 150), sample(300, 200, 180), [250, 250, 250, 250, 250]).firstPartyThresholdTriggered, true);
  assert.equal(assessRegression(sample(50, 200, 150), sample(100, 250, 180), [50, 50, 50, 50, 50]).firstPartyThresholdTriggered, false);
});
test('Lighthouse 13 timings are preserved and URL query strings are redacted', () => {
  const record = networkEntry({ url: 'http://127.0.0.1:3330/?private=value', networkRequestTime: 5.7, networkEndTime: 12.9, transferSize: 100 });
  assert.equal(record.networkRequestTime, 5.7);
  assert.equal(record.networkEndTime, 12.9);
  assert.equal(record.url, 'http://127.0.0.1:3330/');
  assert.throws(() => networkEntry({ url: 'https://example.org', startTime: 0, endTime: 1 }), /networkRequestTime/);
});
test('admin prefetch and its script bytes use the same classification', () => {
  for (const url of ['/admin', '/admin/login?_rsc=x', '/_next/static/chunks/app/admin/login/page.js']) assert.equal(isAdminTraffic(url), true);
  for (const url of ['/', '/products/p0-1', '/_next/static/chunks/app/page.js', 'https://example.org/admin']) assert.equal(isAdminTraffic(url), false);
});
test('new asset capture refuses an existing snapshot before launching a browser', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'matched-capture-test-'));
  try {
    writeFileSync(path.join(dir, 'existing-snapshot'), 'keep');
    const result = spawnSync(process.execPath, ['scripts/ui-review/matched-lighthouse.cjs', 'capture'], { cwd: path.join(__dirname, '..'), env: { ...process.env, P31_ASSETS: dir, P31_OUTPUT: dir }, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /empty.*director/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('matrix reruns refuse an existing output directory before starting servers', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'matched-output-test-'));
  try {
    writeFileSync(path.join(dir, 'original-results'), 'keep');
    const result = spawnSync(process.execPath, ['scripts/ui-review/matched-matrix.cjs'], { cwd: path.join(__dirname, '..'), env: { ...process.env, P31_ASSETS: dir, P31_OUTPUT: dir, P31_BASELINE: dir, P31_RELEASE: dir }, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /empty matrix output directory/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
