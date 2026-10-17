const http = require('node:http');
const { spawn } = require('node:child_process');
const { checkout, port, origin, localEnv } = require('./common.cjs');
const products = require('./fixtures.cjs');
let child;
const server = http.createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json');
    try {
        let raw = '';
        for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 65536)
                throw new Error('Request too large');
        }
        const command = cmd => {
            if (!Array.isArray(cmd) || cmd.length !== 2 || String(cmd[0]).toLowerCase() !== 'get' || cmd[1] !== 'portfolio_data_v4') {
                throw new Error('Only synthetic content GET is supported');
            }
            return { result: JSON.stringify({ products }) };
        };
        const body = JSON.parse(raw);
        res.end(JSON.stringify(req.url === '/pipeline' ? body.map(command) : command(body)));
    }
    catch {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: 'Synthetic read-only responder rejected request' }));
    }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port + 1, '127.0.0.1', () => {
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
        cwd: checkout, stdio: 'inherit', env: { ...localEnv(), UPSTASH_REDIS_REST_URL: `http://127.0.0.1:${port + 1}`, UPSTASH_REDIS_REST_TOKEN: 'synthetic-only' }
    });
    child.on('error', error => { console.error(error.message); server.close(); process.exitCode = 1; });
    child.on('exit', code => { server.close(); process.exitCode = code ?? 1; });
    console.log(`Synthetic app: ${origin}; no real storage or provider credentials`);
});
for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => {
        child?.kill(signal);
        server.close();
    });
