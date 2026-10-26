const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const loadTs = require('./load-ts.cjs');

async function renderEmbed(url) {
  const effects = [], requests = [], changes = [];
  const LinkPreview = loadTs('components/LinkPreview.tsx', {
    react: {
      useState: value => [value, next => changes.push(next)],
      useEffect: effect => effects.push(effect),
    },
    'next/image': { default: () => null },
    '@/components/ContentSkeletons': { SkeletonBlock: () => null },
  }).default;
  const plugins = loadTs('lib/embeds/plugins.ts');
  const resolver = loadTs('lib/embeds/resolve-embed.ts', { '@/lib/embeds/plugins': plugins });
  const SmartEmbed = loadTs('components/SmartEmbed.tsx', {
    '@/components/LinkPreview': { default: LinkPreview },
    '@/lib/embeds/plugins': plugins,
    '@/lib/embeds/resolve-embed': resolver,
    '@/lib/preview-policy': loadTs('lib/preview-policy.ts'),
  }).default;
  const realFetch = global.fetch;
  global.fetch = async path => {
    requests.push(path);
    return { ok: true, json: async () => ({ url, title: 'Synthetic preview' }) };
  };
  try {
    const html = renderToStaticMarkup(SmartEmbed({ url }));
    const cleanups = effects.map(effect => effect());
    await new Promise(resolve => setImmediate(resolve));
    cleanups.forEach(cleanup => cleanup?.());
    return { html, requests, changes };
  } finally { global.fetch = realFetch; }
}

test('unsupported preview hosts render the direct-link fallback without a rejected API request', async () => {
  const url = 'https://outside.example/article';
  const { html, requests } = await renderEmbed(url);
  assert.deepEqual(requests, []);
  assert.doesNotMatch(html, /Đang tải bản xem trước/);
  assert.match(html, /Không thể tải bản xem trước\. Mở liên kết để đọc tiếp\./);
  assert.match(html, /href="https:\/\/outside\.example\/article"/);
  assert.match(html, /rel="noreferrer noopener"/);
});

test('allowed previews retain metadata loading and YouTube retains its iframe', async () => {
  const url = 'https://github.com/example/project';
  const allowed = await renderEmbed(url);
  assert.deepEqual(allowed.requests, [`/api/preview?url=${encodeURIComponent(url)}`]);
  assert.match(allowed.html, /Đang tải bản xem trước/);
  assert.ok(allowed.changes.includes('success'));
  const youtube = await renderEmbed('https://youtu.be/synthetic-video');
  assert.deepEqual(youtube.requests, []);
  assert.match(youtube.html, /<iframe/);
});

test('configured preview domains replace defaults in both host matching and rendering', async () => {
  const previous = process.env.PREVIEW_ALLOWED_DOMAINS;
  process.env.PREVIEW_ALLOWED_DOMAINS = ' .ALLOWED.example,allowed.example ';
  try {
    const { isAllowedPreviewHost } = loadTs('lib/preview-policy.ts');
    assert.equal(isAllowedPreviewHost('allowed.example'), true);
    assert.equal(isAllowedPreviewHost('sub.ALLOWED.example'), true);
    assert.equal(isAllowedPreviewHost('notallowed.example'), false);
    assert.equal(isAllowedPreviewHost('allowed.example.evil.test'), false);
    assert.equal(isAllowedPreviewHost('github.com'), false);
    const url = 'https://sub.allowed.example/article';
    assert.deepEqual((await renderEmbed(url)).requests, [`/api/preview?url=${encodeURIComponent(url)}`]);
    assert.deepEqual((await renderEmbed('https://github.com/disabled-by-config')).requests, []);
  } finally {
    if (previous === undefined) delete process.env.PREVIEW_ALLOWED_DOMAINS;
    else process.env.PREVIEW_ALLOWED_DOMAINS = previous;
  }
});
