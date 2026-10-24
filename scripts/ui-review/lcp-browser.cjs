// Fixed-viewport diagnostics and real portrait fallback, using only local/synthetic responses.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { origin, receipt, artifact } = require('./common.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const result = [];
  try {
    for (const [width, height, dpr] of [[390, 844, 1], [1440, 1000, 1], [390, 844, 3]]) {
      for (const javascriptEnabled of process.argv[2] === 'baseline' ? [true] : [true, false]) {
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, javaScriptEnabled: javascriptEnabled });
        await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
        const page = await context.newPage();
        await page.goto(origin, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.querySelector('img[alt="Chân dung Nguyễn Trãi"]').complete);
        // evaluate works via automation with page JavaScript disabled as well.
        const state = await page.evaluate(async () => {
          await document.fonts.ready;
          const img = document.querySelector('img[alt="Chân dung Nguyễn Trãi"]');
          const geometry = el => { const r = el.getBoundingClientRect(); return { rect: r.toJSON(), visibleArea:
            Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) }; };
          return { image: { ...geometry(img), currentSrc: img.currentSrc, complete: img.complete, naturalWidth: img.naturalWidth, alt: img.alt },
            quotation: geometry(img.parentElement.nextElementSibling), fonts: document.fonts.status,
            imagePreloads: document.querySelectorAll('link[rel="preload"][as="image"]').length,
            resources: performance.getEntriesByType('resource').filter(r => /nguyen-trai|\/_next\/image/.test(r.name)).map(r => r.toJSON()),
            overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert.ok(state.image.naturalWidth > 0);
        assert.equal(state.overflow, false);
        if (javascriptEnabled) assert.ok(state.image.visibleArea > 0);
        if (process.argv[2] !== 'baseline') assert.equal(state.imagePreloads, 1);
        await page.screenshot({ path: artifact(`hero-${width}-dpr${dpr}-js${javascriptEnabled}.png`) });
        result.push({ width, height, dpr, javascriptEnabled, ...state });
        await context.close();
      }
    }
    if (process.argv[2] !== 'baseline') for (const remoteFails of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const requests = [];
      await context.route('**/*', route => {
        const url = route.request().url();
        if (url.includes('/_next/image?')) return route.abort();
        if (url.startsWith('https://upload.wikimedia.org/')) {
          requests.push(url);
          return remoteFails ? route.abort() : route.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync('public/nguyen-trai.jpg') });
        }
        return new URL(url).origin === origin ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      await page.goto(origin, { waitUntil: 'networkidle' });
      const image = page.getByAltText('Chân dung Nguyễn Trãi', { exact: true });
      await image.waitFor();
      assert.match(await image.getAttribute('src'), /^https:\/\/upload.wikimedia.org\//);
      assert.equal(requests.length, 1, 'One fallback attempt, no retry loop');
      const state = await image.evaluate(el => ({ complete: el.complete, naturalWidth: el.naturalWidth, alt: el.alt }));
      assert.equal(state.naturalWidth > 0, !remoteFails);
      assert.equal(await page.locator('h1').count(), 1);
      result.push({ fallback: true, remoteFails, requests, state });
      await context.close();
    }
    receipt('lcp-browser.json', result);
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
