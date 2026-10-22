const { pathToFileURL } = require('node:url');
const { origin, artifact, receipt } = require('./common.cjs');
(async () => {
  const { default: lighthouse } = await import(pathToFileURL(require.resolve('lighthouse')).href);
  const { default: desktopConfig } = await import(pathToFileURL(require('node:path').join(require('node:path').dirname(require.resolve('lighthouse')), 'config/desktop-config.js')).href);
  const chromeLauncher = await import(pathToFileURL(require.resolve('chrome-launcher')).href);
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox'] });
  try {
    const results = [];
    for (const desktop of [false, true]) {
      const profile = desktop ? 'desktop' : 'mobile';
      const options = { port: chrome.port, output: 'json', onlyCategories: ['performance', 'accessibility'],
        logLevel: 'error', blockedUrlPatterns: ['*vercel*'], screenEmulation: { mobile: !desktop,
          width: desktop ? 1440 : 390, height: desktop ? 1000 : 844, deviceScaleFactor: 1, disabled: false } };
      const run = await lighthouse(origin + '/', options, desktop ? desktopConfig : undefined);
      require('node:fs').writeFileSync(artifact(`lighthouse-${profile}.json`), run.report);
      results.push({ profile, lighthouseVersion: run.lhr.lighthouseVersion, settings: run.lhr.configSettings,
        scores: Object.fromEntries(Object.entries(run.lhr.categories).map(([key, value]) => [key, value.score])),
        audits: Object.fromEntries(['largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time', 'color-contrast'].map(key => [key, run.lhr.audits[key]])) });
    }
    receipt('lighthouse-summary.json', results);
  } finally { await chrome.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
