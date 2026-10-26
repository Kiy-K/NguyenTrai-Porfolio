const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { origin, artifact, receipt } = require('./common.cjs');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
      const context = await browser.newContext({ viewport });
      const requests = [], errors = [];
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname === '/api/preview') {
          const target = url.searchParams.get('url');
          requests.push(target);
          const ok = target === 'https://github.com/synthetic/preview-ok';
          return route.fulfill({ status: ok ? 200 : 502, contentType: 'application/json', body: JSON.stringify(ok
            ? { url: target, title: 'Synthetic metadata loaded', description: 'Synthetic description' }
            : { error: 'Could not fetch target URL' }) });
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/products/p0-1`, { waitUntil: 'networkidle' });
      await page.getByText('Synthetic metadata loaded', { exact: true }).waitFor();
      const fallback = page.locator('a[href="https://outside.example/article"]').first();
      await fallback.getByText('Không thể tải bản xem trước. Mở liên kết để đọc tiếp.', { exact: true }).waitFor();
      assert.equal(await fallback.getAttribute('target'), '_blank');
      assert.match(await fallback.getAttribute('rel'), /noopener/);
      await fallback.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await fallback.evaluate(e => e.matches(':focus-visible')), true);
      await page.locator('a[href="https://github.com/synthetic/preview-fails"]')
        .getByText('Không thể tải bản xem trước. Mở liên kết để đọc tiếp.', { exact: true }).waitFor();
      assert.deepEqual(requests.sort(), ['https://github.com/synthetic/preview-fails', 'https://github.com/synthetic/preview-ok']);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: artifact(`preview-${viewport.width}.png`), fullPage: true });
      results.push({ viewport, unsupportedRequests: 0, allowedRequests: 2, allowedMetadata: true, upstreamFallback: true, keyboardFallback: true, errors });
      await context.close();
    }
    receipt('preview-browser.json', results);
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
