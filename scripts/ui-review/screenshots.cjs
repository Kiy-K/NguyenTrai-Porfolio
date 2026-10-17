const { chromium } = require('playwright');
const { origin, artifact, receipt } = require('./common.cjs');
const assert = require('node:assert/strict');
const label = process.argv[2] || 'after';
if (!['before', 'after'].includes(label)) throw new Error('Use before or after');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const results = [];
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();
      for (const [name, route] of [['home', '/'], ['section', '/sections/tu-tuong-nhan-nghia'], ['detail', '/products/p0-1']]) {
        await page.goto(origin + route, { waitUntil: 'networkidle' });
        assert.equal(await page.locator('h1').count(), 1);
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {}))); });
        const filename = `${label}-${name}-${viewport.width}.png`;
        await page.screenshot({ path: artifact(filename) });
        results.push({ viewport, route, title: await page.title(), screenshot: filename });
      }
      await context.close();
    }
    receipt(`screenshots-${label}.json`, results);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
