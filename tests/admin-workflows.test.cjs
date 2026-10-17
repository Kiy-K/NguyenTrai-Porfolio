const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const loadTs = require('./load-ts.cjs');

function mount(file, mocks = {}, props = { isMutationPending: false, setIsMutationPending() {} }) {
  const states = [], refs = [], effects = [];
  let stateIndex = 0, refIndex = 0;
  const component = loadTs(file, {
    react: {
      useState(initial) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
      },
      useRef(initial) { return refs[refIndex++] ??= { current: initial }; },
      useEffect(effect) { effects.push(effect); },
    },
    '@/components/admin/StatusMessage': { default: () => null },
    '@/components/admin/ConfirmDialog': { default: () => null },
    ...mocks,
  }).default;
  return { states, effects, render() { stateIndex = 0; refIndex = 0; return component(props); } };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
function find(tree, predicate) { const node = nodes(tree).find(predicate); assert.ok(node, 'expected control exists'); return node; }
const tick = () => new Promise(resolve => setImmediate(resolve));
const status = tree => find(tree, n => n.props?.status).props.status;
const constants = loadTs('lib/constants.ts');
function form() {
  return mount('components/admin/ArticleForm.tsx', {
    'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/lib/constants': constants,
    '@/components/admin/MediaEditor': { default: () => null },
  });
}

test('article validation blocks whitespace and a failed save retains all fields/media', async () => {
  const app = form();
  let tree = app.render();
  const change = (id, value) => find(tree, n => n.props?.id === id).props.onChange({ target: { name: id.replace('article-', ''), value } });
  change('article-title', '   ');
  tree = app.render();
  let requests = 0;
  const before = global.fetch;
  global.fetch = async () => { requests++; return { ok: false, json: async () => ({ error: 'Thử lại sau' }) }; };
  try {
    await find(tree, n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(requests, 0);
    assert.match(status(app.render()).message, /tiêu đề/);
    tree = app.render(); change('article-title', 'Nguyễn Trãi');
    tree = app.render(); change('article-description', 'Nội dung tác giả');
    tree = app.render();
    await find(tree, n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    tree = app.render();
    assert.equal(requests, 1);
    assert.equal(find(tree, n => n.props?.id === 'article-title').props.value, 'Nguyễn Trãi');
    assert.match(status(tree).message, /Nội dung đã nhập vẫn được giữ lại/);
  } finally { global.fetch = before; }
});

test('feedback read needs password, sends existing contract and clears records on failure', async () => {
  const app = mount('components/admin/FeedbackPanel.tsx');
  let tree = app.render();
  const read = () => find(tree, n => n.type === 'button').props.onClick();
  let payload;
  const before = global.fetch;
  global.fetch = async (url, init) => { payload = [url, JSON.parse(init.body)]; return { ok: true, json: async () => ({ feedback: [{ id: 'test', text: 'Đóng góp', nameHash: 'hash' }] }) }; };
  try {
    await read();
    assert.equal(payload, undefined);
    assert.match(status(app.render()).message, /mật khẩu/);
    find(tree, n => n.props?.id === 'feedback-password').props.onChange({ target: { value: ' proof ' } });
    tree = app.render(); await read();
    assert.deepEqual(payload, ['/api/admin/feedback/read', { password: 'proof', limit: 50 }]);
    tree = app.render(); assert.equal(nodes(tree).filter(n => n.type === 'tbody').length, 1);
    global.fetch = async () => { throw new Error('offline'); };
    await read(); tree = app.render();
    assert.equal(nodes(tree).filter(n => n.type === 'tbody').length, 0);
    assert.equal(status(tree).type, 'error');
  } finally { global.fetch = before; }
});

test('clear-all requires exact confirmation and downloads the server recovery copy', async () => {
  const app = mount('components/admin/SecurityActions.tsx', {
    'next/navigation': { useRouter: () => ({ replace() {}, push() {} }) },
    '@/lib/constants': constants, '@/components/BackButton': { default: () => null },
  });
  let tree = app.render();
  find(tree, n => n.type === 'button' && n.props.children === 'Xóa toàn bộ dữ liệu (Clear DB)').props.onClick();
  tree = app.render();
  const confirm = () => find(tree, n => n.type === 'button' && n.props.children === 'Xóa Dữ Liệu');
  const previous = { fetch: global.fetch, document: global.document, setTimeout: global.setTimeout, create: URL.createObjectURL };
  let requests = 0, blob, downloaded = false;
  global.fetch = async (url, init) => { requests++; assert.equal(init.method, 'DELETE'); assert.equal(JSON.parse(init.body).confirm, constants.CLEAR_ALL_CONFIRMATION); return { ok: true, json: async () => ({ deleted: [{ id: 'recoverable', images: ['preserved'] }] }) }; };
  URL.createObjectURL = value => { blob = value; return 'blob:test'; };
  global.document = { body: { appendChild() {} }, createElement: () => ({ click() { downloaded = true; }, remove() {} }) };
  global.setTimeout = () => 1;
  try {
    assert.equal(confirm().props.disabled, true);
    await confirm().props.onClick(); assert.equal(requests, 0);
    find(tree, n => n.props?.id === 'clear-confirm').props.onChange({ target: { value: constants.CLEAR_ALL_CONFIRMATION } });
    tree = app.render(); await confirm().props.onClick();
    assert.equal(requests, 1); assert.equal(downloaded, true);
    assert.deepEqual(JSON.parse(await blob.text()), { products: [{ id: 'recoverable', images: ['preserved'] }] });
    assert.equal(status(app.render()).type, 'success');
  } finally { global.fetch = previous.fetch; global.document = previous.document; global.setTimeout = previous.setTimeout; URL.createObjectURL = previous.create; }
});

function media() {
  const changes = { images: [], videos: [], statuses: [] };
  const app = mount('components/admin/MediaEditor.tsx', {
    'next/image': { default: () => null }, '@/components/MuxVideoPlayer': { default: () => null },
  }, { images: [], uploadedMuxVideos: [], setImages: value => { changes.images = value(changes.images); }, setUploadedMuxVideos: value => { changes.videos = value(changes.videos); }, setStatus: value => changes.statuses.push(value), onBusyChange() {} });
  return { app, changes };
}

test('video cancellation during URL preparation ignores the late response', async () => {
  const { app, changes } = media();
  let resolve;
  const previous = global.fetch;
  global.fetch = () => new Promise(done => { resolve = done; });
  try {
    let tree = app.render();
    find(tree, n => n.type === 'input' && n.props.accept === 'video/*').props.onChange({ target: { files: [{ type: 'video/mp4' }] } });
    tree = app.render();
    find(tree, n => n.type === 'button' && n.props.children === 'Hủy upload').props.onClick();
    resolve({ ok: true, json: async () => ({ uploadUrl: 'https://invalid.test', uploadId: 'id' }) });
    await tick();
    assert.equal(changes.statuses.at(-1).type, null);
    assert.equal(nodes(app.render()).filter(n => n.type === 'progress').length, 0);
  } finally { global.fetch = previous; }
});

test('Mux progress comes from bytes and abort cannot revive an upload error', async () => {
  const { app, changes } = media();
  const previous = { fetch: global.fetch, xhr: global.XMLHttpRequest };
  let xhr;
  global.fetch = async () => ({ ok: true, json: async () => ({ uploadUrl: 'https://invalid.test', uploadId: 'id' }) });
  global.XMLHttpRequest = class {
    handlers = {}; upload = { addEventListener: (name, fn) => { this.progress = fn; } };
    constructor() { xhr = this; }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    open() {} send() {} abort() { this.handlers.abort(); }
  };
  try {
    let tree = app.render();
    find(tree, n => n.type === 'input' && n.props.accept === 'video/*').props.onChange({ target: { files: [{ type: 'video/mp4' }] } });
    await tick();
    xhr.progress({ lengthComputable: true, loaded: 42, total: 100 });
    tree = app.render();
    assert.equal(find(tree, n => n.type === 'progress').props.value, 42);
    find(tree, n => n.type === 'button' && n.props.children === 'Hủy upload').props.onClick();
    await tick(); assert.equal(changes.statuses.at(-1).type, null);
    assert.equal(changes.videos.length, 0);
  } finally { global.fetch = previous.fetch; global.XMLHttpRequest = previous.xhr; }
});

test('unmount aborts XHR and ignores pending asset poll result', async () => {
  const { app, changes } = media();
  const previous = { fetch: global.fetch, xhr: global.XMLHttpRequest, window: global.window, document: global.document };
  let xhr, resolvePoll;
  global.window = global.document = { addEventListener() {}, removeEventListener() {} };
  global.fetch = async url => url.includes('upload-url') ? { ok: true, json: async () => ({ uploadUrl: 'https://invalid.test', uploadId: 'id' }) } : new Promise(done => { resolvePoll = done; });
  global.XMLHttpRequest = class {
    handlers = {}; upload = { addEventListener() {} }; status = 200;
    constructor() { xhr = this; }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    open() {} send() {} abort() { this.handlers.abort(); }
  };
  try {
    const tree = app.render();
    const cleanup = app.effects[1]();
    find(tree, n => n.type === 'input' && n.props.accept === 'video/*').props.onChange({ target: { files: [{ type: 'video/mp4' }] } });
    await tick(); xhr.handlers.load(); await tick();
    assert.ok(resolvePoll);
    cleanup();
    resolvePoll({ ok: true, json: async () => ({ status: 'ready', playbackId: 'late', assetId: 'late' }) });
    await tick(); assert.equal(changes.videos.length, 0);
  } finally { global.fetch = previous.fetch; global.XMLHttpRequest = previous.xhr; global.window = previous.window; global.document = previous.document; }
});

test('image uploads expose completed-file counts and reject oversized images without I/O', async () => {
  const { app, changes } = media();
  const previous = global.fetch;
  let resolveUpload, calls = 0;
  global.fetch = async () => { calls++; return new Promise(done => { resolveUpload = done; }); };
  const select = files => find(app.render(), n => n.type === 'input' && n.props.accept === 'image/*').props.onChange({ target: { files } });
  try {
    select([new File(['x'], 'too-large.png', { type: 'image/png' })].map(file => ({ name: file.name, type: file.type, size: 11 * 1024 * 1024 })));
    assert.equal(calls, 0);
    assert.match(changes.statuses.at(-1).message, /10MB/);
    select([new File(['x'], 'one.png', { type: 'image/png' }), new File(['y'], 'two.png', { type: 'image/png' })]);
    assert.match(find(app.render(), n => n.props?.role === 'status').props.children.join(''), /0\/2/);
    resolveUpload({ ok: true, json: async () => ({ secure_url: 'https://invalid.test/one.png' }) });
    await tick();
    assert.match(find(app.render(), n => n.props?.role === 'status').props.children.join(''), /1\/2/);
    assert.deepEqual(changes.images, ['https://invalid.test/one.png']);
    resolveUpload({ ok: true, json: async () => ({ secure_url: 'https://invalid.test/two.png' }) });
    await tick();
    assert.equal(changes.images.length, 2);
    assert.equal(changes.statuses.at(-1).type, 'success');
  } finally { global.fetch = previous; }
});

test('an existing mutation disables save and clear controls', async () => {
  const app = mount('components/admin/ArticleForm.tsx', {
    'next/navigation': { useRouter: () => ({ push() {} }) }, '@/lib/constants': constants,
    '@/components/admin/MediaEditor': { default: () => null },
  }, { isMutationPending: true, setIsMutationPending() { throw new Error('must not start another mutation'); } });
  assert.equal(find(app.render(), n => n.type === 'button' && n.props.type === 'submit').props.disabled, true);
  const security = mount('components/admin/SecurityActions.tsx', {
    'next/navigation': { useRouter: () => ({}) }, '@/lib/constants': constants,
    '@/components/BackButton': { default: () => null },
  }, { isMutationPending: true, setIsMutationPending() { throw new Error('must not start another mutation'); } });
  assert.equal(find(security.render(), n => n.type === 'button').props.disabled, true);
});

test('confirmation uses native modal focus containment, Escape callback and focus restoration', () => {
  let effect, cancelled = 0;
  const { default: ConfirmDialog } = loadTs('components/admin/ConfirmDialog.tsx', {
    react: { useRef: () => ({ current: null }), useEffect: fn => { effect = fn; } },
  });
  const previous = { document: global.document, HTMLElement: global.HTMLElement };
  const calls = [];
  class Element { isConnected = true; focus() { calls.push('restore'); } }
  global.HTMLElement = Element;
  global.document = { activeElement: new Element() };
  try {
    const tree = ConfirmDialog({ titleId: 'confirm-heading', onCancel: () => { cancelled++; }, children: null });
    assert.equal(tree.type, 'dialog');
    assert.equal(tree.props['aria-labelledby'], 'confirm-heading');
    tree.props.ref.current = { showModal: () => calls.push('showModal'), close: () => calls.push('close'), querySelector: () => ({ focus: () => calls.push('cancel-focus') }) };
    const cleanup = effect();
    assert.deepEqual(calls, ['showModal', 'cancel-focus']);
    tree.props.onCancel(); assert.equal(cancelled, 1);
    cleanup(); assert.deepEqual(calls, ['showModal', 'cancel-focus', 'close', 'restore']);
  } finally { global.document = previous.document; global.HTMLElement = previous.HTMLElement; }
});
