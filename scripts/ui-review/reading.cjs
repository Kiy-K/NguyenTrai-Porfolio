// Synthetic production-build P7 checks; existing read-only storage harness only.
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { origin, artifact, receipt, localEnv } = require('./common.cjs');
const fixture = { id: 'reading & legacy', title: 'Bài viết dài '.repeat(12) + '<img src=x onerror=alert(1)>', description: 'Nội dung do tác giả viết.', images: [], tags: ['ĐẠO ĐỨC'], references: [{ title: 'Nguồn in', author: 'Tác giả nguồn' }] };
const additions = [fixture,
  { ...fixture, id: 'reading-first', title: 'Bài viết cùng chuyên mục', tags: ['dao duc'] },
  { ...fixture, id: 'reading-backfill', title: 'Bài viết cùng thẻ', section: 'unknown' },
  { ...fixture, id: 'reading-malformed', section: 'unknown', videos: {} },
  { ...fixture, id: 'reading-draft', status: 'draft' },
  { ...fixture, id: 'reading-archived', status: 'archived' },
  { ...fixture, id: 'reading-unknown', title: 'Bài viết không rõ chuyên mục', section: 'unknown', tags: [] },
  { ...fixture, id: 'reading%20literal', title: 'ID có phần trăm', section: 'unknown', tags: [] },
];
const log = fs.openSync(artifact('reading-server.log'), 'w');
const server = spawn(process.execPath, ['-e', `require('./scripts/ui-review/fixtures.cjs').push(...${JSON.stringify(additions)}); require('./scripts/ui-review/server.cjs');`], { env: localEnv(), stdio: ['ignore', log, log] });
let browser, debugPage;
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
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/admin/auth/status') return route.fulfill({ status: 401, json: { authenticated: false } });
      return route.continue();
    });
    const page = await context.newPage();
    debugPage = page;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const articleUrl = origin + '/products/' + encodeURIComponent(fixture.id);
    await page.goto(articleUrl, { waitUntil: 'networkidle' });
    const nav = page.getByRole('navigation', { name: 'Đường dẫn trang', exact: true });
    const related = page.getByRole('region', { name: 'Bài viết liên quan', exact: true });
    await nav.waitFor();
    await related.waitFor();
    assert.equal(await nav.locator('li').count(), 3);
    assert.equal(await nav.locator('[aria-current="page"]').textContent(), fixture.title);
    assert.equal(await nav.locator('img,script').count(), 0);
    assert.equal(await related.getByRole('link').count(), 3);
    const links = await related.getByRole('link').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    assert.equal(links[0], '/products/reading-first');
    assert.equal(new Set(links).size, links.length);
    assert.ok(!links.includes('/products/reading-backfill'));
    assert.ok(!links.includes('/products/' + encodeURIComponent(fixture.id)));
    assert.equal(await related.locator('img,video,iframe,button,a a').count(), 0);
    const columns = await related.locator('ul').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.equal(columns, viewport.width === 390 ? 1 : 3);
    const graphs = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.flatMap(node => JSON.parse(node.textContent)));
    const crumbs = graphs.find(graph => graph['@type'] === 'BreadcrumbList').itemListElement;
    const visible = await nav.locator('li').evaluateAll(nodes => nodes.map(node => ({ name: node.lastElementChild.textContent, href: node.lastElementChild.getAttribute('href') })));
    assert.deepEqual(visible.map(item => item.name), crumbs.map(item => item.name));
    assert.deepEqual(visible.slice(0, -1).map(item => item.href), crumbs.slice(0, -1).map(item => new URL(item.item).pathname));
    assert.equal(await page.getByRole('region', { name: 'Nguồn tham khảo', exact: true }).locator('li').count(), 1);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://nguyen-trai-porfolio.vercel.app/products/' + encodeURIComponent(fixture.id));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    await nav.getByRole('link').first().focus();
    await page.keyboard.press('Tab');
    assert.equal(await nav.getByRole('link').nth(1).evaluate(el => el === document.activeElement && el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none'), true);
    await page.screenshot({ path: artifact(`reading-article-${viewport.width}.png`), fullPage: true });
    await related.screenshot({ path: artifact(`reading-related-${viewport.width}.png`) });
    await nav.getByRole('link').nth(1).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/sections/tu-tuong-nhan-nghia');
    await nav.waitFor();
    assert.equal(await nav.locator('li').count(), 2);
    assert.equal(await nav.locator('[aria-current="page"]').textContent(), 'Tư tưởng nhân nghĩa');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: artifact(`reading-section-${viewport.width}.png`), fullPage: false });
    await nav.getByRole('link', { name: 'Trang chủ', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(origin + '/');
    await page.goto(articleUrl, { waitUntil: 'networkidle' });
    await related.getByRole('link').first().focus();
    assert.equal(await related.getByRole('link').first().evaluate(el => el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none'), true);
    await page.keyboard.press('Enter');
    await page.waitForURL('**/products/reading-first');
    await page.getByRole('heading', { level: 1, name: 'Bài viết cùng chuyên mục', exact: true }).waitFor();
    await page.goto(origin + '/products/reading%2520literal', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { level: 1, name: 'ID có phần trăm', exact: true }).waitFor();
    assert.equal(await nav.locator('[aria-current="page"]').textContent(), 'ID có phần trăm');
    await page.goto(origin + '/products/reading-unknown', { waitUntil: 'networkidle' });
    assert.equal(await nav.locator('li').count(), 2);
    assert.equal(await related.count(), 0);
    await page.goto(origin + '/products/reading-backfill', { waitUntil: 'networkidle' });
    assert.equal(await related.getByRole('link').count(), 2);
    for (const id of ['reading-missing', 'reading-malformed', 'reading-draft', 'reading-archived']) {
      await page.goto(origin + '/products/' + id, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: /404/ }).waitFor();
      assert.equal(await nav.count(), 0);
      assert.equal(await related.count(), 0);
      assert.equal(await page.locator('script[type="application/ld+json"]').count(), 0);
      assert.ok(await page.locator('meta[name="robots"]').evaluateAll(nodes => nodes.some(node => node.content.includes('noindex'))));
    }
    assert.deepEqual(errors, []);
    results.push({ viewport, reducedMotion: true, assertions: 'visible/JSON-LD names and ancestor paths, default/unknown sections, keyboard focus and real ancestor/card navigation, references, canonical, escaped XSS, deterministic unique max-three links, no media, one/three columns, empty/backfill states, no overflow, private/malformed/missing noindex without navigation', pageErrors: errors });
    await context.close();
  }
  receipt('reading-browser.json', results);
  console.log(JSON.stringify(results, null, 2));
})().catch(async error => { console.error(error); if (debugPage) { console.error('Failed URL:', debugPage.url(), await debugPage.locator('body').innerText()); await debugPage.screenshot({ path: artifact('reading-failure.png'), fullPage: true }); } process.exitCode = 1; }).finally(async () => { await browser?.close(); server.kill('SIGTERM'); fs.closeSync(log); });
