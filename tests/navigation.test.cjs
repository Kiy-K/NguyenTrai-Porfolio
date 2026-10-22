const { test } = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

test('mobile navigation uses a labelled native modal and synchronizes open/close state', () => {
  const state = [], effects = [];
  let cursor = 0, shown = 0, closed = 0;
  const dialog = { showModal: () => { shown++; }, close: () => { closed++; } };
  const { default: Navigation } = loadTs('components/Navigation.tsx', {
    react: {
      Suspense: 'suspense',
      useState(initial) { const i = cursor++; state[i] ??= initial; return [state[i], v => { state[i] = v; }]; },
      useRef: value => ({ current: value === null ? dialog : value }),
      useEffect: effect => effects.push(effect),
    },
    'next/navigation': { usePathname: () => '/' },
    'next/link': { default: 'a' },
  });
  const render = () => { cursor = 0; return Navigation().props.children.type(); };
  const nodes = el => !el || typeof el !== 'object' ? [] : Array.isArray(el) ? el.flatMap(nodes) : [el, ...nodes(el.props?.children)];
  let tree = render();
  const modal = nodes(tree).find(n => n.type === 'dialog');
  assert.ok(modal, 'offscreen links must live inside a closed native dialog');
  assert.equal(modal.props['aria-label'], 'Trình đơn chính');
  const toggle = nodes(tree).find(n => n.props?.['aria-controls'] === 'main-navigation-menu');
  assert.equal(toggle.props['aria-expanded'], false);
  toggle.props.onClick();
  tree = render();
  assert.equal(shown, 1);
  assert.equal(nodes(tree).find(n => n.props?.['aria-controls']).props['aria-expanded'], true);
  nodes(tree).find(n => n.props?.['aria-label'] === 'Đóng trình đơn').props.onClick();
  assert.equal(closed, 1);
  modal.props.onClose();
  tree = render();
  assert.equal(nodes(tree).find(n => n.props?.['aria-controls']).props['aria-expanded'], false);
});

test('keyboard focus outline contrasts with light content and dark navigation', () => {
  const css = require('node:fs').readFileSync('app/globals.css', 'utf8');
  const color = name => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i'))[1];
  const luminance = hex => {
    const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return rgb.reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  };
  assert.match(css, /outline: 2px solid var\(--color-focus\)/);
  for (const background of [color('parchment'), color('ink'), '#FFFFFF']) {
    const [dark, light] = [luminance(color('focus')), luminance(background)].sort((a, b) => a - b);
    assert.ok((light + 0.05) / (dark + 0.05) >= 3, `focus contrast on ${background}`);
  }
});
