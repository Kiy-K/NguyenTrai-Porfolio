const { spawn } = require('node:child_process');
const { checkout, localEnv } = require('./common.cjs');
const child = spawn('npm', ['run', 'build', '--', '--webpack'], { cwd: checkout, stdio: 'inherit', env: localEnv() });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
