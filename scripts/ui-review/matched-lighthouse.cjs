// Issue #34: one cold-browser sample per invocation; run sequentially from a pinned target checkout.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const [action, profile = 'mobile', widget = 'on', sample = '1', animation = 'on'] = process.argv.slice(2);
assert.ok(['capture', 'sample'].includes(action));
assert.ok(['mobile', 'desktop'].includes(profile));
assert.ok(['on', 'off'].includes(widget));
assert.ok(['on', 'off'].includes(animation));
const origin = 'http://127.0.0.1:3330';
const output = process.env.P31_OUTPUT;
assert.ok(output, 'P31_OUTPUT required');
const cache = process.env.P31_ASSETS;
assert.ok(cache, 'P31_ASSETS required');
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(cache, { recursive: true });
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const safeURL = value => {
  try { const url = new URL(value); return url.origin + url.pathname; } catch { return String(value); }
};
(async () => {
  const loadBefore = os.loadavg();
  const { default: lighthouse } = await import(pathToFileURL(require.resolve('lighthouse')).href);
  const { default: desktopConfig } = await import(pathToFileURL(path.join(path.dirname(require.resolve('lighthouse')), 'config/desktop-config.js')).href);
  const { launch } = await import(pathToFileURL(require.resolve('chrome-launcher')).href);
  const { default: puppeteer } = await import(pathToFileURL(require.resolve('puppeteer-core')).href);
  const chrome = await launch({ chromeFlags: ['--headless', '--no-sandbox', '--disable-background-networking'] });
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
  const page = await browser.newPage();
  const manifestPath = path.join(cache, 'manifest.json');
  const assets = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const misses = new Set();
  if (animation === 'off') await page.evaluateOnNewDocument(() => {
    const disable = () => {
      if (!document.head) return;
      const style = document.createElement('style');
      style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
      document.head.appendChild(style);
      observer.disconnect();
    };
    const observer = new MutationObserver(disable);
    observer.observe(document, { childList: true, subtree: true });
    disable();
  });
  await page.setRequestInterception(true);
  page.on('request', async request => {
    try {
      const url = request.url();
      if (url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:')) return await request.continue();
      // Analytics and all writes are blocked in capture and replay alike. No conversation is started.
      if (request.method() !== 'GET' || /vercel|vitals\.vercel/i.test(url)) return await request.abort();
      if (widget === 'off' && /unpkg\.com|elevenlabs\.io/.test(new URL(url).hostname)) return await request.abort();
      assert.equal(new URL(url).protocol, 'https:', 'External capture is HTTPS only');
      const key = digest(url);
      if (!assets[key] && action === 'capture') {
        const response = await fetch(url, { signal: AbortSignal.timeout(20000), credentials: 'omit' });
        const body = Buffer.from(await response.arrayBuffer());
        assets[key] = { url: safeURL(url), resolvedURL: safeURL(response.url), status: response.status,
          contentType: response.headers.get('content-type') || 'application/octet-stream', bytes: body.length, sha256: digest(body) };
        fs.writeFileSync(path.join(cache, key), body);
        fs.writeFileSync(manifestPath, JSON.stringify(assets, null, 2));
      }
      if (!assets[key]) { misses.add(safeURL(url)); return await request.abort(); }
      const meta = assets[key];
      const body = fs.readFileSync(path.join(cache, key));
      assert.equal(digest(body), meta.sha256);
      await request.respond({ status: meta.status, contentType: meta.contentType,
        headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' }, body });
    } catch (error) {
      misses.add(String(error.message));
      if (!request.isInterceptResolutionHandled()) await request.abort();
    }
  });
  try {
    if (action === 'capture') {
      await page.goto(origin, { waitUntil: 'networkidle0', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 10000));
      console.log(JSON.stringify({ assets: Object.keys(assets).length, misses: [...misses], widget: await page.evaluate(() => Boolean(document.querySelector('elevenlabs-convai')?.shadowRoot)) }));
      assert.equal(misses.size, 0, 'Capture must complete before freezing assets');
      return;
    }
    const options = { port: chrome.port, output: 'json', onlyCategories: ['performance', 'accessibility'],
      logLevel: 'error', blockedUrlPatterns: ['*vercel*'], screenEmulation: { mobile: profile === 'mobile',
        width: profile === 'mobile' ? 390 : 1440, height: profile === 'mobile' ? 844 : 1000, deviceScaleFactor: 1, disabled: false } };
    const run = await lighthouse(origin + '/', options, profile === 'desktop' ? desktopConfig : undefined, page);
    assert.ok(run && !run.lhr.runtimeError, JSON.stringify(run?.lhr.runtimeError));
    assert.equal(misses.size, 0, `Frozen asset miss: ${[...misses].join(', ')}`);
    const widgetRendered = await page.evaluate(() => Boolean(document.querySelector('elevenlabs-convai')?.shadowRoot));
    assert.equal(widgetRendered, widget === 'on', 'Widget ablation must actually differ');
    const audits = run.lhr.audits;
    const metrics = Object.fromEntries(['total-blocking-time', 'largest-contentful-paint', 'cumulative-layout-shift', 'speed-index', 'interactive'].map(key => [key, audits[key]?.numericValue ?? null]));
    assert.ok(Number.isFinite(metrics['total-blocking-time']));
    const record = { observedAt: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      nodeVersion: process.version, lighthouseVersion: run.lhr.lighthouseVersion, browser: await browser.version(),
      platform: { os: os.type(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0].model, cores: os.cpus().length, loadBefore, loadAfter: os.loadavg() },
      profile, widget, widgetRendered, animation, sample: Number(sample), assetManifestSha256: digest(fs.readFileSync(manifestPath)),
      settings: run.lhr.configSettings, metrics, scores: Object.fromEntries(Object.entries(run.lhr.categories).map(([key, value]) => [key, value.score])),
      diagnostics: Object.fromEntries(['mainthread-work-breakdown', 'bootup-time', 'long-tasks', 'unused-javascript', 'third-party-summary', 'lcp-breakdown-insight', 'lcp-discovery-insight', 'color-contrast'].filter(key => audits[key]).map(key => [key, audits[key]])),
      network: (audits['network-requests']?.details?.items || []).map(item => ({ url: safeURL(item.url), resourceType: item.resourceType, transferSize: item.transferSize, resourceSize: item.resourceSize, startTime: item.startTime, endTime: item.endTime, statusCode: item.statusCode })) };
    const stem = `${profile}-widget-${widget}-${sample}`;
    fs.writeFileSync(path.join(output, stem + '.json'), JSON.stringify(record, null, 2));
    // Full reports/traces contain only synthetic content and public frozen assets; retain separately for inspection.
    fs.writeFileSync(path.join(output, stem + '.lhr.json.gz'), gzipSync(run.report));
    fs.writeFileSync(path.join(output, stem + '.trace.json.gz'), gzipSync(JSON.stringify(run.artifacts.Trace)));
    console.log(JSON.stringify({ profile, widget, sample, ...metrics, scores: record.scores }));
  } finally { await browser.close(); await chrome.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
