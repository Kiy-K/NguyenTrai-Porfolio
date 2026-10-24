// Synthetic production-build smoke: all writes/providers are intercepted or disabled.
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { origin, artifact, receipt, localEnv } = require('./common.cjs');
const fixture = {
  id: 'references', title: 'Bài viết có nguồn', description: 'Nội dung tác giả giữ nguyên.', images: [], status: 'published',
  references: [
    { title: 'Sách in về Nguyễn Trãi', author: 'Tác giả thử nghiệm', publisher: 'Ấn bản thử nghiệm' },
    { title: 'Tài liệu trực tuyến ' + 'dài'.repeat(90), url: 'https://example.org/source' },
    { title: '<img src=x onerror=alert(1)>', author: '<script>alert(2)</script>', publisher: '<svg onload=alert(3)>' },
    { title: 'Nguồn lưu trữ có URL không an toàn', url: 'javascript:alert(1)' },
  ],
};
const log = fs.openSync(artifact('references-server.log'), 'w');
const server = spawn(process.execPath, ['-e', `require('./scripts/ui-review/fixtures.cjs').push(${JSON.stringify(fixture)}); require('./scripts/ui-review/server.cjs');`], {
  env: localEnv(), stdio: ['ignore', log, log],
});
const results = [];
let browser;
(async () => {
  for (let attempt = 0; ; attempt++) {
    if (server.exitCode !== null) throw Error('Synthetic server exited; see references-server.log');
    if (await fetch(origin).then(r => r.ok).catch(() => false)) break;
    if (attempt >= 100) throw Error('Synthetic server did not become ready');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const errors = [];
    let payload, saves = 0, saveMode = 'error';
    await context.addCookies([{ name: 'admin_session', value: 'synthetic-only', url: origin }]);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/admin/auth/status') return route.fulfill({ json: { authenticated: true } });
      if (url.pathname === '/api/suggest-title') return route.fulfill({ json: { suggestions: [] } });
      if (url.pathname === '/api/products' && route.request().method() === 'POST') {
        payload = route.request().postDataJSON(); saves++;
        return route.fulfill({ status: saveMode === 'success' ? 201 : 503, json: saveMode === 'success' ? { success: true } : { error: 'Lỗi lưu thử nghiệm' } });
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/products/references', { waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).pathname, '/products/references');
    const section = page.getByRole('region', { name: 'Nguồn tham khảo', exact: true });
    await section.waitFor();
    assert.equal(await section.locator('li').count(), 4);
    assert.equal(await section.locator('a').count(), 1);
    assert.equal(await section.locator('script,img,svg').count(), 0);
    assert.equal(await section.getByRole('link').getAttribute('target'), '_blank');
    assert.equal(await section.getByRole('link').getAttribute('rel'), 'noopener noreferrer');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await section.getByRole('link').focus();
    assert.equal(await section.getByRole('link').evaluate(el => el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none'), true);
    await section.screenshot({ path: artifact(`references-public-${viewport.width}.png`) });
    await page.goto(origin + '/products/p0-1', { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('heading', { name: 'Nguồn tham khảo', exact: true }).count(), 0);
    await page.screenshot({ path: artifact(`references-legacy-${viewport.width}.png`) });
    for (const id of ['draft', 'archived']) {
      const response = await context.request.get(origin + '/api/products/' + id);
      assert.equal(response.status(), 404);
      await page.goto(origin + '/products/' + id, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: /404/ }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Nguồn tham khảo', exact: true }).count(), 0);
    }
    await page.goto(origin + '/admin', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Thêm Bài Viết Mới' }).waitFor();
    await page.locator('#article-title').fill('Bài viết thử nghiệm');
    await page.locator('#article-description').fill('Nội dung tác giả');
    const add = page.getByRole('button', { name: 'Thêm nguồn tham khảo', exact: true });
    const submit = page.locator('form button[type="submit"]');
    await add.focus(); await page.keyboard.press('Enter');
    await submit.click();
    await page.getByText('Vui lòng nhập tên nguồn.', { exact: true }).waitFor();
    assert.equal(await page.locator('#reference-0-title').evaluate(el => el === document.activeElement), true);
    assert.equal(saves, 0);
    await page.locator('#reference-0-title').fill(' Sách in ');
    await page.locator('#reference-0-url').fill('javascript:alert(1)');
    await submit.click();
    await page.getByText('Dùng URL đầy đủ bắt đầu bằng http:// hoặc https://.', { exact: true }).waitFor();
    assert.equal(saves, 0);
    await page.locator('#reference-0-url').fill('');
    await add.click();
    await page.locator('#reference-1-title').fill('Nguồn web');
    await page.locator('#reference-1-url').fill('https://example.org');
    await page.getByRole('button', { name: 'Chuyển nguồn 2 lên', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('input[id$="-title"]').nth(1).inputValue(), 'Nguồn web');
    await submit.click();
    await page.getByRole('alert').filter({ hasText: 'Nội dung đã nhập vẫn được giữ lại' }).waitFor();
    assert.deepEqual(payload.references, [{ title: 'Nguồn web', url: 'https://example.org' }, { title: 'Sách in' }]);
    assert.equal(await page.locator('#reference-0-title').inputValue(), ' Sách in ');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('#reference-1-title').scrollIntoViewIfNeeded();
    await page.screenshot({ path: artifact(`references-admin-${viewport.width}.png`) });
    await page.getByRole('button', { name: 'Xóa nguồn 1', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await add.evaluate(el => el === document.activeElement), true);
    saveMode = 'success'; await submit.click();
    await page.getByRole('status').filter({ hasText: 'Thêm bài viết thành công' }).waitFor();
    assert.deepEqual(payload.references, [{ title: 'Sách in' }]);
    assert.equal(await page.locator('input[id^="reference-"]').count(), 0);
    assert.equal(saves, 2);
    await page.waitForURL('**/sections/**');
    await page.goto(origin + '/admin', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Thêm Bài Viết Mới' }).waitFor();
    for (let i = 0; i < 20; i++) await add.click();
    assert.equal(await add.isDisabled(), true);
    await page.getByRole('button', { name: 'Xóa nguồn 20', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.id === 'add-article-reference');
    assert.equal(await add.isEnabled(), true);
    assert.equal(await page.locator('input[id$="-title"]').count(), 20); // Article title + 19 sources.
    assert.deepEqual(errors, []);
    results.push({ viewport, public: 'escaped text, safe links, book, ordered sources, no overflow, focus visible', legacy: 'no sources section', private: 'draft/archived hidden on API and page', admin: 'keyboard add/reorder/remove, row errors, failed-save retention, success reset, 20-source cap and focus restoration after removal', pageErrors: errors });
    await context.close();
  }
  receipt('references-browser.json', results);
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close(); server.kill('SIGTERM'); fs.closeSync(log);
});
