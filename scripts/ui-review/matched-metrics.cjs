const assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:3330';

function isAdminTraffic(value) {
  const url = new URL(value, origin);
  return url.origin === origin && (url.pathname === '/admin' || url.pathname.startsWith('/admin/') || url.pathname.includes('/static/chunks/app/admin/'));
}

function networkEntry(item) {
  const url = new URL(item.url);
  assert.ok(Number.isFinite(item.networkRequestTime), 'Missing Lighthouse networkRequestTime');
  assert.ok(Number.isFinite(item.networkEndTime), 'Missing Lighthouse networkEndTime');
  return { url: url.origin + url.pathname, resourceType: item.resourceType,
    transferSize: item.transferSize, resourceSize: item.resourceSize,
    networkRequestTime: item.networkRequestTime, networkEndTime: item.networkEndTime, statusCode: item.statusCode };
}

function assessRegression(baseline, release, pairedTbtDeltas) {
  const delta = release.tbt.median - baseline.tbt.median;
  const preliminaryTbtSignal = delta > 100 && delta > baseline.tbt.median * 0.2 && pairedTbtDeltas.filter(x => x > 0).length >= 4;
  const firstPartyAttributionIncrease = release.firstPartyExecution.median > baseline.firstPartyExecution.median
    || release.firstPartyLongTaskDuration.median > baseline.firstPartyLongTaskDuration.median;
  return { preliminaryTbtSignal, firstPartyAttributionIncrease,
    firstPartyThresholdTriggered: preliminaryTbtSignal && firstPartyAttributionIncrease };
}
module.exports = { isAdminTraffic, networkEntry, assessRegression };
