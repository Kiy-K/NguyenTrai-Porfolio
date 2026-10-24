// Sequential issue #37 runs. Pass an immutable JSON plan; finish builds before scoring.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const planPath = process.argv[2];
const plan = JSON.parse(fs.readFileSync(planPath));
const output = process.env.P31_OUTPUT;
assert.ok(output && process.env.P31_ASSETS);
assert.equal(process.version, 'v24.22.1');
fs.mkdirSync(output, { recursive: true });
assert.equal(fs.readdirSync(output).length, 0, 'Use a new output directory');
for (const target of plan.targets) {
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: target.cwd, encoding: 'utf8' }).trim(), target.revision);
}
fs.copyFileSync(planPath, path.join(output, 'plan.json'));
let server;
async function stop() {
  if (!server) return;
  const child = server;
  server = null;
  child.kill('SIGINT');
  await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve));
}
async function sample(target, profile, widget, round) {
  const log = fs.openSync(path.join(output, 'commands.log'), 'a');
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(__dirname, 'lcp-lighthouse.cjs'), 'sample', profile, widget, String(round)], {
        cwd: target.cwd, env: { ...process.env, P31_OUTPUT: path.join(output, target.label) }, stdio: ['ignore', log, log] });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${target.label}/${profile}/${round}: ${code}`)));
    });
    console.log(`${target.label} ${profile} ${widget} ${round} PASS`);
  } finally { fs.closeSync(log); }
}
(async () => {
  try {
    for (let round = 1; round <= 5; round++) {
      for (const target of round % 2 ? plan.targets : [...plan.targets].reverse()) {
        const log = fs.openSync(path.join(output, `${target.label}-server.log`), 'a');
        server = spawn(process.execPath, [path.join(__dirname, 'server.cjs')], { cwd: target.cwd, env: process.env, stdio: ['ignore', log, log] });
        fs.closeSync(log);
        let ready = false;
        for (let attempt = 0; attempt < 60; attempt++) {
          if (server.exitCode !== null) throw new Error('Synthetic server exited');
          try { const r = await fetch('http://127.0.0.1:3330/'); await r.arrayBuffer(); ready = r.ok; } catch { /* Startup only. */ }
          if (ready) break;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        assert.ok(ready);
        const optimizer = [];
        for (const width of [256, 640, 1920]) {
          const start = performance.now();
          const r = await fetch(`http://127.0.0.1:3330/_next/image?url=%2Fnguyen-trai.jpg&w=${width}&q=75`, { headers: { accept: 'image/avif,image/webp,image/*,*/*;q=0.8' } });
          const body = Buffer.from(await r.arrayBuffer());
          assert.ok(r.ok);
          optimizer.push({ width, duration: performance.now() - start, bytes: body.length,
            type: r.headers.get('content-type'), cache: r.headers.get('x-nextjs-cache'),
            sha256: require('node:crypto').createHash('sha256').update(body).digest('hex') });
        }
        fs.writeFileSync(path.join(output, `${target.label}-optimizer-${round}.json`), JSON.stringify(optimizer, null, 2));
        for (const widget of plan.widgets) {
          await sample(target, 'mobile', widget, round);
          if (round <= 2) await sample(target, 'desktop', widget, round);
        }
        await stop();
      }
    }
  } finally { await stop(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
