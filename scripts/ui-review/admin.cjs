const { origin, artifact, receipt, checkout } = require('./common.cjs');
const path = require('node:path');
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs');
(async () => {
    const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const result = [];
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
        for (const auth of ['pending', 'rejected', 'offline', 'accepted']) {
            const c = await b.newContext({ viewport, acceptDownloads: true });
            await c.addCookies([{ name: 'admin_session', value: 'synthetic-only', url: origin }]);
            let saves = 0, deletes = 0, saveMode = 'error', clearMode = 'error';
            const errors = [];
            await c.addInitScript(() => { window.XMLHttpRequest = class extends EventTarget {
                constructor() { super(); this.upload = new EventTarget(); this.status = 200; }
                open(method, url) { this.url = url; }
                send() { window.syntheticUpload = this; this.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: 50, total: 100 })); }
                abort() { this.dispatchEvent(new Event('abort')); }
            }; window.completeSyntheticUpload = () => { const x = window.syntheticUpload; x.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: 100, total: 100 })); x.dispatchEvent(new Event('load')); }; });
            await c.route('**/*', async (r) => { const u = new URL(r.request().url()), path = u.pathname; if (u.origin !== origin)
                return r.abort(); if (path === '/api/admin/auth/status') {
                if (auth === 'pending')
                    return;
                if (auth === 'offline')
                    return r.abort();
                return r.fulfill({ status: auth === 'accepted' ? 200 : 401, json: { authenticated: auth === 'accepted' } });
            } if (path === '/api/suggest-title')
                return r.fulfill({ json: { suggestions: [] } }); if (path === '/api/admin/feedback/read')
                return r.fulfill({ json: { feedback: [{ id: 'test', nameHash: 'hash-name', classHash: 'hash-class', emailHash: 'hash-email', text: 'Nội dung phản hồi thử nghiệm', createdAtUnix: 1700000000 }] } }); if (path === '/api/products' && r.request().method() === 'POST') {
                saves++;
                return r.fulfill({ status: saveMode === 'success' ? 200 : 503, json: saveMode === 'success' ? { success: true } : { error: 'Lỗi lưu thử nghiệm' } });
            } if (path === '/api/products' && r.request().method() === 'DELETE') {
                deletes++;
                return r.fulfill({ status: clearMode === 'success' ? 200 : 503, json: clearMode === 'success' ? { deleted: [] } : { error: 'Lỗi xóa thử nghiệm' } });
            } if (path === '/api/upload')
                return r.fulfill({ json: { secure_url: '/nguyen-trai.jpg' } }); if (path === '/api/mux/upload-url')
                return r.fulfill({ json: { uploadUrl: origin + '/synthetic-upload', uploadId: 'synthetic' } }); if (path === '/api/mux/asset/synthetic')
                return r.fulfill({ json: { status: 'ready', assetId: 'synthetic-asset', playbackId: 'synthetic-playback' } }); return r.continue(); });
            const p = await c.newPage();
            p.on('pageerror', e => errors.push(e.message));
            await p.goto(origin + '/admin', { waitUntil: 'domcontentloaded' });
            if (auth !== 'accepted') {
                if (auth === 'pending') {
                    await p.getByText('Đang xác thực quản trị…', { exact: true }).first().waitFor();
                    assert.equal(await p.locator('form').count(), 0);
                }
                else
                    await p.waitForURL('**/admin/login');
                assert.equal(saves, 0);
                assert.equal(deletes, 0);
                result.push({ viewport, auth, gate: 'passed' });
                await c.close();
                continue;
            }
            await p.getByRole('heading', { name: 'Thêm Bài Viết Mới' }).waitFor();
            assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await p.screenshot({ path: artifact(`nguyentrai-roadmap-admin-${viewport.width}.png`) });
            await p.locator('#article-title').fill('   ');
            await p.locator('#article-description').fill('Mô tả bài viết do tác giả viết.');
            await p.getByRole('button', { name: /Lưu Bài Viết|Đăng bài|Thêm bài viết|Lưu bài/i }).last().click();
            await p.getByRole('alert').filter({ hasText: 'Vui lòng nhập tiêu đề' }).waitFor();
            assert.equal(saves, 0);
            await p.locator('#article-title').fill('Bài viết thử nghiệm');
            await p.locator('form button[type="submit"]').click();
            await p.getByRole('alert').filter({ hasText: 'Nội dung đã nhập vẫn được giữ lại' }).waitFor();
            assert.equal(await p.locator('#article-title').inputValue(), 'Bài viết thử nghiệm');
            await p.locator('#feedback-password').fill('synthetic-password');
            await p.getByRole('button', { name: 'Tải feedback đã hash' }).click();
            await p.getByText('Nội dung phản hồi thử nghiệm', { exact: true }).waitFor();
            await p.locator('#admin-images').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlKkAAAAASUVORK5CYII=', 'base64') });
            await p.getByRole('status').filter({ hasText: 'Tải lên thành công 1 ảnh' }).waitFor();
            assert.equal(await p.getByAltText('Ảnh đã tải 1').count(), 1);
            await p.locator('#admin-video').setInputFiles({ name: 'test.mp4', mimeType: 'video/mp4', buffer: Buffer.from('synthetic') });
            const progress = p.getByRole('progressbar', { name: 'Tiến độ tải video' });
            await progress.waitFor();
            await p.waitForFunction(() => document.querySelector('progress')?.value === 50);
            assert.equal(await p.locator('form button[type="submit"]').isDisabled(), true);
            await p.getByRole('button', { name: /Hủy upload/ }).click();
            await progress.waitFor({ state: 'hidden' });
            await p.locator('#admin-video').setInputFiles({ name: 'ready.mp4', mimeType: 'video/mp4', buffer: Buffer.from('synthetic-ready') });
            await progress.waitFor();
            await p.waitForFunction(() => document.querySelector('progress')?.value === 50);
            await p.evaluate(() => window.completeSyntheticUpload());
            await p.getByText('Đã tải 1 video:', { exact: true }).waitFor();
            await p.getByRole('button', { name: 'Xóa toàn bộ dữ liệu (Clear DB)' }).click();
            const dialog = p.getByRole('dialog', { name: 'Xóa toàn bộ bài viết?' });
            await dialog.waitFor();
            const del = dialog.getByRole('button', { name: 'Xóa Dữ Liệu', exact: true });
            assert.equal(await del.isDisabled(), true);
            await p.locator('#clear-confirm').fill('incorrect');
            assert.equal(await del.isDisabled(), true);
            await p.keyboard.press('Escape');
            await dialog.waitFor({ state: 'hidden' });
            assert.equal(await p.getByRole('button', { name: 'Xóa toàn bộ dữ liệu (Clear DB)' }).evaluate(el => el === document.activeElement), true);
            assert.equal(deletes, 0);
            await p.getByRole('button', { name: 'Xóa toàn bộ dữ liệu (Clear DB)' }).click();
            await p.locator('#clear-confirm').fill('XÓA TOÀN BỘ');
            await del.click();
            await p.getByRole('alert').filter({ hasText: 'Lỗi xóa thử nghiệm' }).waitFor();
            assert.equal(deletes, 1);
            saveMode = 'success';
            await p.locator('form button[type="submit"]').click();
            await p.getByRole('status').filter({ hasText: 'Thêm bài viết thành công' }).waitFor();
            assert.equal(saves, 2);
            assert.deepEqual(errors, []);
            await p.waitForURL('**/sections/**');
            await p.goto(origin + '/admin', { waitUntil: 'domcontentloaded' });
            await p.getByRole('heading', { name: 'Thêm Bài Viết Mới' }).waitFor();
            clearMode = 'success';
            await p.getByRole('button', { name: 'Xóa toàn bộ dữ liệu (Clear DB)' }).click();
            await p.locator('#clear-confirm').fill('XÓA TOÀN BỘ');
            await p.screenshot({ path: artifact(`nguyentrai-roadmap-confirm-${viewport.width}.png`) });
            const [download] = await Promise.all([p.waitForEvent('download'), p.getByRole('dialog', { name: 'Xóa toàn bộ bài viết?' }).getByRole('button', { name: 'Xóa Dữ Liệu', exact: true }).click()]);
            assert.match(download.suggestedFilename(), /^products-backup-/);
            assert.deepEqual(JSON.parse(fs.readFileSync(await download.path(), 'utf8')), { products: [] });
            result.push({ viewport, auth, workflow: 'passed', saves, deletes, errors, recoveryDownload: true });
            await c.close();
        }
    }
    await b.close();
    receipt('admin-browser.json', result);
    console.log(result);
})().catch(e => { console.error(e); process.exit(1); });
