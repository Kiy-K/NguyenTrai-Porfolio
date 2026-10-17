const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const checkout = process.cwd();
const port = Number(process.env.UI_REVIEW_PORT || 3330);
if (!Number.isInteger(port) || port < 1024 || port > 65534)
    throw new Error('Invalid UI_REVIEW_PORT');
const origin = `http://127.0.0.1:${port}`;
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || path.join(os.tmpdir(), 'nguyentrai-ui-review'));
fs.mkdirSync(output, { recursive: true });
const artifact = name => path.join(output, name);
function receipt(name, result) {
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
    fs.writeFileSync(artifact(name), JSON.stringify({ observedAt: new Date().toISOString(), revision, nodeVersion: process.version, origin, result }, null, 2));
}
function localEnv() {
    return { ...process.env, PERSISTENCE_BACKEND: 'redis', DATA_WRITE_PAUSED: '1',
        UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '', DATABASE_URL: '', APP_DATABASE_URL: '',
        GEMINI_API_KEY: '', MISTRAL_API_KEY: '', BRAINTRUST_API_KEY: '', BRAINTRUST_PROJECT_NAME: '',
        CLOUDINARY_URL: '', MUX_TOKEN_ID: '', MUX_TOKEN_SECRET: '', NEXT_PUBLIC_MUX_DATA_ENV_KEY: '',
        NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'ci-placeholder', ADMIN_BOOTSTRAP_TOKEN: '',
        OTEL_PROPAGATE_CONTEXT_URLS: '', PREVIEW_ALLOWED_DOMAINS: '', APP_URL: origin,
        ADMIN_AUTH_PEPPER: 'synthetic-test-only', FEEDBACK_HASH_PEPPER: 'synthetic-test-only' };
}
module.exports = { checkout, port, origin, artifact, receipt, localEnv };
