const { origin, artifact, receipt, checkout } = require('./common.cjs');
const path = require('node:path');
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs');
(async () => {
    const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const results = [];
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
        const c = await b.newContext({ viewport });
        const errors = [];
        await c.route('**/*', r => new URL(r.request().url()).origin !== origin ? r.abort() : r.continue());
        const p = await c.newPage();
        p.on('pageerror', e => errors.push(e.message));
        for (const [name, path] of [['home', '/'], ['section', '/sections/tu-tuong-nhan-nghia'], ['detail', '/products/p0-1']]) {
            await p.goto(origin + path, { waitUntil: 'networkidle' });
            assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            assert.equal(await p.locator('h1').count(), 1);
            await p.screenshot({ path: artifact(`nguyentrai-p1-after-${name}-${viewport.width}.png`) });
        }
        if (viewport.width === 390) {
            await p.goto(origin + '/', { waitUntil: 'networkidle' });
            const toggle = p.getByRole('button', { name: 'Mở trình đơn chính' }), dialog = p.getByRole('dialog', { name: 'Trình đơn chính' });
            assert.equal(await dialog.isVisible(), false);
            await toggle.focus();
            await p.keyboard.press('Enter');
            await dialog.waitFor();
            assert.equal(await p.evaluate(() => document.body.style.overflow), 'hidden');
            assert.equal(await p.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), true);
            await p.keyboard.press('Tab');
            await p.keyboard.press('Tab');
            await p.keyboard.press('Tab');
            assert.equal(await p.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), true);
            await p.screenshot({ path: artifact('nguyentrai-p1-mobile-menu.png') });
            await p.keyboard.press('Escape');
            assert.equal(await dialog.isVisible(), false);
            assert.equal(await p.evaluate(() => document.activeElement.getAttribute('aria-controls')), 'main-navigation-menu');
            assert.notEqual(await p.evaluate(() => document.body.style.overflow), 'hidden');
            await toggle.click();
            await p.setViewportSize({ width: 1440, height: 1000 });
            await p.waitForFunction(() => !document.querySelector('dialog').open);
            assert.notEqual(await p.evaluate(() => document.body.style.overflow), 'hidden');
            await p.setViewportSize(viewport);
            await p.emulateMedia({ reducedMotion: 'reduce' });
            const reduced = await p.locator('h1').evaluate(el => getComputedStyle(el.parentElement).animationDuration);
            assert.ok(parseFloat(reduced) <= 0.001);
        }
        await p.goto(origin + '/sections/tu-tuong-nhan-nghia', { waitUntil: 'networkidle' });
        const back = p.getByRole('button', { name: 'Về trang chủ' });
        await p.keyboard.press('Tab');
        await back.focus();
        assert.equal(await back.evaluate(el => el.matches(':focus-visible')), true);
        await p.waitForFunction(() => getComputedStyle(document.querySelector('button[aria-label="Về trang chủ"]')).outlineColor === 'rgb(166, 122, 10)');
        assert.equal(await back.evaluate(el => getComputedStyle(el).outlineColor), 'rgb(166, 122, 10)');
        await p.screenshot({ path: artifact(`focus-section-${viewport.width}.png`) });
        const cards = p.locator('[class~="group/card"]');
        const heights = await cards.evaluateAll(items => items.slice(0, 3).map(el => el.getBoundingClientRect().height));
        if (viewport.width === 1440)
            assert.ok(Math.max(...heights) - Math.min(...heights) < 1);
        assert.deepEqual(errors, []);
        results.push({ viewport, errors, overflow: false, cardHeights: heights, routes: ['/', '/sections/tu-tuong-nhan-nghia', '/products/p0-1'] });
        await c.close();
    }
    await b.close();
    receipt('public-browser.json', results);
    console.log(results);
})().catch(e => { console.error(e); process.exit(1); });
