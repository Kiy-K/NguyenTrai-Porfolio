// Synthetic production-build SEO checks; no real storage/provider credentials.
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { origin, artifact, receipt, localEnv } = require('./common.cjs');
const canonical = 'https://nguyen-trai-porfolio.vercel.app';
const fixture = {
  id: 'seo-legacy', title: 'Bài viết & nguồn </script><img src=x onerror=alert(1)>',
  description: 'Nội dung do tác giả viết & giữ nguyên.', images: [], section: 'Tư tưởng nhân nghĩa',
  references: [{ title: 'Nguồn in', author: 'Tác giả nguồn' }, { title: '<script>alert(1)</script>', url: 'https://example.org/source' }],
  createdAt: '2024-02-29T12:00:00Z',
};
const log = fs.openSync(artifact('seo-server.log'), 'w');
const server = spawn(process.execPath, ['-e', `require('./scripts/ui-review/fixtures.cjs').push(${JSON.stringify(fixture)}); require('./scripts/ui-review/server.cjs');`], { env: localEnv(), stdio: ['ignore', log, log] });
let browser;
const results = [];
(async () => {
  for (let i = 0; ; i++) {
    if (server.exitCode !== null) throw Error('Synthetic server exited');
    if (await fetch(origin).then(r => r.ok).catch(() => false)) break;
    if (i >= 100) throw Error('Server readiness timeout');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const [path, title, description, type] of [
      ['/', 'Nguyễn Trãi - Danh nhân văn hóa thế giới', 'Tìm hiểu về cuộc đời và sự nghiệp của Nguyễn Trãi', 'website'],
      ['/sections/tu-tuong-nhan-nghia', 'Tư tưởng nhân nghĩa | Nguyễn Trãi', 'Các bài viết trong chuyên mục Tư tưởng nhân nghĩa về Nguyễn Trãi.', 'website'],
      ['/products/seo-legacy', fixture.title + ' | Nguyễn Trãi', fixture.description, 'article'],
    ]) {
      await page.goto(origin + path, { waitUntil: 'networkidle' });
      await page.waitForFunction(title => document.title === title, title);
      assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), description);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonical + path);
      assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), canonical + path);
      assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), title);
      assert.equal(await page.locator('meta[property="og:description"]').getAttribute('content'), description);
      assert.equal(await page.locator('meta[property="og:type"]').getAttribute('content'), type);
      assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute('content'), 'summary');
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'index, follow');
      const graphs = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.flatMap(node => JSON.parse(node.textContent)));
      assert.ok(graphs.some(graph => graph['@type'] === (path === '/' ? 'WebSite' : path.startsWith('/products') ? 'Article' : 'BreadcrumbList')));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (path.startsWith('/products')) {
        assert.equal(graphs[0].headline, fixture.title);
        const references = page.getByRole('region', { name: 'Nguồn tham khảo', exact: true });
        assert.equal(await references.locator('li').count(), 2);
        assert.equal(await references.locator('script,img').count(), 0);
        assert.equal(await page.locator('img[src="x"]').count(), 0);
        await page.screenshot({ path: artifact(`seo-public-${viewport.width}.png`), fullPage: true });
      }
      // Blocking bot response must contain metadata without JavaScript execution.
      const response = await context.request.get(origin + path, { headers: { 'user-agent': 'Googlebot' } });
      assert.equal(response.status(), 200);
      const html = await response.text();
      assert.ok(html.includes('rel="canonical" href="' + canonical + path + '"'));
      assert.ok(html.includes('application/ld+json'));
      assert.ok(!html.includes('<img src=x onerror='));
    }
    for (const path of ['/products/draft', '/products/archived', '/products/p6-missing', '/sections/p6-missing']) {
      const response = await context.request.get(origin + path, { headers: { 'user-agent': 'Googlebot' } });
      assert.equal(response.status(), 404);
      assert.match(await response.text(), /name="robots" content="noindex/);
    }
    const api = await context.request.get(origin + '/api/products/seo-legacy');
    assert.deepEqual((await api.json()).product.references, fixture.references);
    const sitemapResponse = await context.request.get(origin + '/sitemap.xml');
    assert.equal(sitemapResponse.status(), 200);
    const xml = await sitemapResponse.text();
    assert.match(sitemapResponse.headers()['content-type'], /xml/);
    const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
    assert.equal(locations.length, 43); // home + 9 sections + 33 public articles
    for (const location of locations) assert.equal(new URL(location).origin, canonical);
    assert.ok(locations.includes(canonical + '/products/seo-legacy'));
    assert.doesNotMatch(xml, /\/products\/(draft|archived)|\/admin|\/api\//);
    assert.doesNotMatch(xml, /<lastmod>/);
    const robots = await context.request.get(origin + '/robots.txt');
    assert.equal(robots.status(), 200);
    assert.match(await robots.text(), /Disallow: \/admin\nDisallow: \/api\/\n/);
    assert.match(await robots.text(), /Sitemap: https:\/\/nguyen-trai-porfolio.vercel.app\/sitemap.xml/);
    await page.goto(origin + '/admin/login', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
    assert.deepEqual(errors, []);
    results.push({ viewport, assertions: 'metadata, OG, Twitter, canonical, JSON-LD escaping, references round-trip, legacy compatibility, private/missing 404 noindex, sitemap XML, robots, admin noindex, no overflow/page errors' });
    await context.close();
  }
  receipt('seo-browser.json', results);
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); server.kill('SIGTERM'); });
