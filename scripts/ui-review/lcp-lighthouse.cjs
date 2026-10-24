// Issue #37: one cold-browser sample per invocation; run sequentially from a pinned target checkout.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { isAdminTraffic, networkEntry } = require('./matched-metrics.cjs');
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
if (action === 'capture') {
  assert.equal(fs.readdirSync(cache).length, 0, 'New capture requires an empty asset directory');
  assert.equal(fs.readdirSync(output).length, 0, 'New capture requires an empty output directory');
}
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
  const toolVersions = { puppeteer: require('puppeteer-core/package.json').version, chromeLauncher: require('chrome-launcher/package.json').version };
  assert.deepEqual(toolVersions, { puppeteer: '25.14.0', chromeLauncher: '1.2.2' }, 'Use the pinned external tools');
  const chrome = await launch({ chromeFlags: ['--headless', '--no-sandbox', '--disable-background-networking'] });
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
  const page = await browser.newPage();
  const manifestPath = path.join(cache, 'manifest.json');
  const assets = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const misses = new Set();
  let blockedAdminRequests = 0;
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
  await page.evaluateOnNewDocument(() => {
    window.__lcp = { candidates: [], fontsReady: null, imageLoad: null };
    const describe = el => el ? { tag: el.tagName, text: el.textContent?.trim().slice(0, 120),
      rect: el.getBoundingClientRect().toJSON() } : null;
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) window.__lcp.candidates.push({ startTime: e.startTime,
        renderTime: e.renderTime, loadTime: e.loadTime, size: e.size, url: e.url, element: describe(e.element) });
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    document.addEventListener('load', e => {
      if (e.target instanceof HTMLImageElement && e.target.alt === 'Chân dung Nguyễn Trãi')
        window.__lcp.imageLoad = performance.now();
    }, true);
    document.addEventListener('DOMContentLoaded', () => {
      document.fonts.ready.then(() => { window.__lcp.fontsReady = performance.now(); });
    });
  });
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  const imageRequests = [];
  cdp.on('Network.requestWillBeSent', e => {
    if (/nguyen-trai|\/_next\/image/.test(e.request.url)) imageRequests.push({ event: 'request',
      id: e.requestId, url: e.request.url, timestamp: e.timestamp, initiator: e.initiator, priority: e.request.initialPriority });
  });
  cdp.on('Network.responseReceived', e => {
    if (imageRequests.some(r => r.id === e.requestId)) imageRequests.push({ event: 'response', id: e.requestId,
      timestamp: e.timestamp, mimeType: e.response.mimeType, encodedDataLength: e.response.encodedDataLength, timing: e.response.timing });
  });
  cdp.on('Network.resourceChangedPriority', e => {
    if (imageRequests.some(r => r.id === e.requestId)) imageRequests.push({ event: 'priority', id: e.requestId, priority: e.newPriority, timestamp: e.timestamp });
  });
  cdp.on('Network.loadingFinished', e => {
    if (imageRequests.some(r => r.id === e.requestId)) imageRequests.push({ event: 'finished', id: e.requestId, timestamp: e.timestamp, encodedDataLength: e.encodedDataLength });
  });
  await page.setRequestInterception(true);
  page.on('request', async request => {
    try {
      const url = request.url();
      if (isAdminTraffic(url)) { blockedAdminRequests++; return await request.abort(); }
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
    assert.equal(run.lhr.lighthouseVersion, '13.5.0', 'Use the pinned Lighthouse release');
    assert.equal(misses.size, 0, `Frozen asset miss: ${[...misses].join(', ')}`);
    const widgetRendered = await page.evaluate(() => Boolean(document.querySelector('elevenlabs-convai')?.shadowRoot));
    assert.equal(widgetRendered, widget === 'on', 'Widget ablation must actually differ');
    const audits = run.lhr.audits;
    const metrics = Object.fromEntries(['total-blocking-time', 'largest-contentful-paint', 'cumulative-layout-shift', 'speed-index', 'interactive'].map(key => [key, audits[key]?.numericValue ?? null]));
    assert.ok(Number.isFinite(metrics['total-blocking-time']));
    const presentation = await page.evaluate(() => {
      const img = document.querySelector('img[alt="Chân dung Nguyễn Trãi"]');
      const geometry = el => { const r = el.getBoundingClientRect(); return { rect: r.toJSON(),
        intersection: { width: Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)),
          height: Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) } }; };
      return { ...window.__lcp, timeOrigin: performance.timeOrigin, navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
        image: { ...geometry(img), src: img.getAttribute('src'), currentSrc: img.currentSrc, srcset: img.srcset,
          sizes: img.sizes, loading: img.loading, decoding: img.decoding, fetchPriority: img.fetchPriority,
          complete: img.complete, naturalWidth: img.naturalWidth },
        quotation: geometry(img.parentElement.nextElementSibling), fontStatus: document.fonts.status,
        preloads: [...document.querySelectorAll('link[rel="preload"][as="image"]')].map(el => el.outerHTML),
        resources: performance.getEntriesByType('resource').filter(e => /nguyen-trai|\/_next\/image|woff2/.test(e.name)).map(e => e.toJSON()) };
    });
    const record = { observedAt: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      nodeVersion: process.version, lighthouseVersion: run.lhr.lighthouseVersion, browser: await browser.version(),
      platform: { os: os.type(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0].model, cores: os.cpus().length, loadBefore, loadAfter: os.loadavg() },
      presentation, imageRequests, tools: toolVersions, collectorSourceSha256: digest(fs.readFileSync(__filename)), metricsHelperSha256: digest(fs.readFileSync(path.join(__dirname, 'matched-metrics.cjs'))),
      adminPrefetchPolicy: 'blocked', blockedAdminRequests, networkTimingUnit: 'milliseconds since navigation start',
      profile, widget, widgetRendered, animation, sample: Number(sample), assetManifestSha256: digest(fs.readFileSync(manifestPath)),
      settings: run.lhr.configSettings, metrics, scores: Object.fromEntries(Object.entries(run.lhr.categories).map(([key, value]) => [key, value.score])),
      diagnostics: Object.fromEntries(['mainthread-work-breakdown', 'bootup-time', 'long-tasks', 'unused-javascript', 'third-party-summary', 'lcp-breakdown-insight', 'lcp-discovery-insight', 'color-contrast'].filter(key => audits[key]).map(key => [key, audits[key]])),
      network: (audits['network-requests']?.details?.items || []).map(networkEntry) };
    const stem = `${profile}-widget-${widget}-${sample}`;
    assert.ok(!fs.existsSync(path.join(output, stem + '.json')), 'Never overwrite a sample');
    fs.writeFileSync(path.join(output, stem + '.json'), JSON.stringify(record, null, 2));
    // Full reports/traces contain only synthetic content and public frozen assets; retain separately for inspection.
    fs.writeFileSync(path.join(output, stem + '.lhr.json.gz'), gzipSync(run.report));
    fs.writeFileSync(path.join(output, stem + '.trace.json.gz'), gzipSync(JSON.stringify(run.artifacts.Trace)));
    console.log(JSON.stringify({ profile, widget, sample, ...metrics, scores: record.scores }));
  } finally { await browser.close(); await chrome.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
