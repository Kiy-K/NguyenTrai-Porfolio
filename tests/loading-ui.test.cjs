const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const loadTs = require('./load-ts.cjs');

test('content placeholders announce loading once and hide decorative shapes', () => {
  const skeletons = loadTs('components/ContentSkeletons.tsx');
  for (const name of ['ProjectListSkeleton', 'ProductSkeleton', 'AuthSkeleton', 'HomeSkeleton']) {
    const html = renderToStaticMarkup(skeletons[name]());
    assert.equal((html.match(/role="status"/g) || []).length, 1, name);
    assert.match(html, /aria-hidden="true"/);
    assert.doesNotMatch(html, /<(input|button|form)\b/);
  }
});

test('admin controls remain hidden until session validation succeeds', async () => {
  const constants = loadTs('lib/constants.ts');
  for (const outcome of ['pending', 'rejected', 'network', 'accepted']) {
    const effects = [];
    const stateChanges = [];
    const redirects = [];
    let stateIndex = 0;
    const { default: AdminPage } = loadTs('app/admin/page.tsx', {
      react: {
        useState(initial) {
          const index = stateIndex++;
          return [index === 0 ? true : initial, value => stateChanges.push([index, value])];
        },
        useRef: value => ({ current: value }),
        useEffect: effect => effects.push(effect),
      },
      'next/navigation': { useRouter: () => ({ replace: path => redirects.push(path) }) },
      'next/image': { default: () => null },
      '@/lib/constants': constants,
      '@/components/Navigation': { default: () => null },
      '@/components/Footer': { default: () => null },
      '@/components/MuxVideoPlayer': { default: () => null },
      '@/components/BackButton': { default: () => null },
      '@/components/ContentSkeletons': { AuthSkeleton: () => null },
    });
    const fetchBefore = global.fetch;
    global.fetch = async () => {
      if (outcome === 'pending') return new Promise(() => {});
      if (outcome === 'network') throw new Error('offline');
      return { ok: outcome === 'accepted' };
    };
    try {
      const initialUI = AdminPage();
      assert.doesNotMatch(renderToStaticMarkup(initialUI), /<(form|input|textarea)\b/);
      const cleanup = effects[1]();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(stateChanges.some(([index, value]) => index === 1 && value === false), outcome === 'accepted', outcome);
      assert.deepEqual(redirects, ['rejected', 'network'].includes(outcome) ? ['/admin/login'] : []);
      cleanup();
    } finally {
      global.fetch = fetchBefore;
    }
  }
});

test('back control supports client navigation with an empty document referrer', () => {
  const calls = [];
  const { default: BackButton } = loadTs('components/BackButton.tsx', {
    'next/navigation': { useRouter: () => ({ back: () => calls.push('back'), push: path => calls.push(path) }) },
  });
  const previousWindow = global.window;
  const previousDocument = global.document;
  global.document = { referrer: '' };
  try {
    global.window = { history: { length: 2 }, location: { host: 'localhost' } };
    BackButton({ fallbackUrl: '/' }).props.onClick();
    global.window.history.length = 1;
    BackButton({ fallbackUrl: '/' }).props.onClick();
    assert.deepEqual(calls, ['back', '/']);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
  }
});
