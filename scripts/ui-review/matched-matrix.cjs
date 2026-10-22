// Sequential issue #34 matrix. Builds/installs must finish before invoking this file.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const harness = __dirname;
const animationAblation = process.argv[2] === 'animation-off';
assert.ok(!process.argv[2] || animationAblation, 'Only animation-off is supported');
const output = process.env.P31_OUTPUT;
assert.ok(output && process.env.P31_BASELINE && process.env.P31_RELEASE && process.env.P31_ASSETS);
fs.mkdirSync(output, { recursive: true });
assert.equal(fs.readdirSync(output).length, 0, 'Use a new empty matrix output directory');
const targets = { baseline: process.env.P31_BASELINE, release: process.env.P31_RELEASE };
const expected = { baseline: '97da6087a6969975fbb360c3ec966ac6c723fb6d', release: 'a86a991899a84f4ceaa72b2931049331466ff061' };
for (const [label, cwd] of Object.entries(targets)) assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim(), expected[label]);
let activeServer;
async function run(label, profile, widget, round) {
  const log = fs.openSync(path.join(output, 'commands.log'), 'a');
  const args = [path.join(harness, 'matched-lighthouse.cjs'), 'sample', profile, widget, String(round), animationAblation ? 'off' : 'on'];
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, { cwd: targets[label], env: { ...process.env, P31_OUTPUT: path.join(output, label) }, stdio: ['ignore', log, log] });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${label}/${profile}/${widget}/${round} exit=${code}`)));
    });
    console.log(`${label} ${profile} widget-${widget} sample-${round} PASS`);
  } finally { fs.closeSync(log); }
}
async function stop() {
  if (!activeServer) return;
  const child = activeServer;
  activeServer = null;
  child.kill('SIGINT');
  await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve));
}
(async () => {
  try {
    for (let round = 1; round <= 5; round++) {
      for (const label of round % 2 ? ['baseline', 'release'] : ['release', 'baseline']) {
        const log = fs.openSync(path.join(output, `${label}-server.log`), 'a');
        activeServer = spawn(process.execPath, [path.join(harness, 'server.cjs')], { cwd: targets[label], env: process.env, stdio: ['ignore', log, log] });
        fs.closeSync(log);
        let ready = false;
        for (let attempt = 0; attempt < 60; attempt++) {
          if (activeServer.exitCode !== null) throw new Error('Synthetic server exited');
          try { const r = await fetch('http://127.0.0.1:3330/'); await r.arrayBuffer(); ready = r.ok; } catch { /* Startup only. */ }
          if (ready) break;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        assert.ok(ready, 'Synthetic server readiness timeout');
        for (const widget of animationAblation ? ['off'] : ['on', 'off']) {
          await run(label, 'mobile', widget, round);
          if (!animationAblation && round <= 2) await run(label, 'desktop', widget, round);
        }
        await stop();
      }
    }
  } finally { await stop(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
