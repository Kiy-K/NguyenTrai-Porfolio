const { origin, artifact, receipt, checkout } = require('./common.cjs');
const path = require('node:path');
const { chromium } = require('playwright');
const fs = require('node:fs');
(async () => { const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] }); const out = []; for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => { window.labVitals = { lcp: 0, cls: 0, interactionDuration: 0 }; new PerformanceObserver(list => { for (const e of list.getEntries())
        window.labVitals.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); new PerformanceObserver(list => { for (const e of list.getEntries())
        if (!e.hadRecentInput)
            window.labVitals.cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); new PerformanceObserver(list => { for (const e of list.getEntries())
        if (e.interactionId)
            window.labVitals.interactionDuration = Math.max(window.labVitals.interactionDuration, e.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 16 }); });
    const vitals = fs.readFileSync(path.join(checkout, 'node_modules/next/dist/compiled/web-vitals/web-vitals.js'), 'utf8');
    await context.addInitScript({ content: '(function(){var module={exports:{}},__dirname="";' + vitals + ';module.exports.onINP(function(m){window.labVitals.inp=m.value},{reportAllChanges:true});})();' });
    await context.route('**/*', r => new URL(r.request().url()).origin !== origin ? r.abort() : r.continue());
    const p = await context.newPage();
    await p.goto(origin + '/sections/tu-tuong-nhan-nghia', { waitUntil: 'networkidle' });
    const input = p.getByRole('searchbox');
    await input.click();
    await input.pressSequentially('nguyen trai');
    await p.getByRole('status').filter({ hasText: '11 tác phẩm' }).waitFor();
    await p.getByLabel('Sắp xếp tác phẩm').selectOption('title-desc');
    await p.getByRole('button', { name: 'Lịch sử', exact: true }).click();
    await p.getByRole('status').filter({ hasText: '6 tác phẩm' }).waitFor();
    await p.waitForTimeout(200);
    out.push({ viewport, ...await p.evaluate(() => window.labVitals) });
    await context.close();
} await browser.close(); receipt('vitals-' + (process.argv[2] || 'after') + '.json', out); console.log(out); })().catch(e => { console.error(e); process.exit(1); });
