const { test } = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const searchAdapter = loadTs('lib/product-search.ts', { minisearch: { default: require('minisearch') } });

test('list pagination resets on query, sort, tags and clear; shrunk lists stay visible', () => {
  const state = [];
  let cursor = 0;
  const { default: ProjectList } = loadTs('components/ProjectList.tsx', {
    react: {
      useState(initial) {
        const i = cursor++;
        if (state[i] === undefined) state[i] = initial;
        return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
      },
      useMemo: fn => fn(),
    },
    '@/lib/product-search': searchAdapter,
    '@/components/ProjectCard': { default: () => null },
  });
  const products = Array.from({ length: 21 }, (_, i) => ({
    id: i, title: `Tác phẩm ${String(i).padStart(2, '0')}`, description: '', images: [], tags: ['Văn học'],
  }));
  const render = (items = products) => { cursor = 0; return ProjectList({ products: items }); };
  const nodes = element => {
    if (!element || typeof element !== 'object') return [];
    if (Array.isArray(element)) return element.flatMap(nodes);
    return [element, ...nodes(element.props?.children)];
  };
  const byLabel = (tree, label) => nodes(tree).find(n => n.props?.['aria-label'] === label);
  let tree = render();
  byLabel(tree, 'Trang 3').props.onClick();
  tree = render();
  assert.equal(byLabel(tree, 'Trang 3').props['aria-current'], 'page');
  for (const label of ['Tìm kiếm tác phẩm', 'Sắp xếp tác phẩm']) {
    byLabel(tree, label).props.onChange({ target: { value: label.startsWith('Tìm') ? 'tac' : 'title-desc' } });
    tree = render();
    assert.equal(byLabel(tree, 'Trang 1').props['aria-current'], 'page');
    byLabel(tree, 'Trang 3').props.onClick(); tree = render();
  }
  nodes(tree).find(n => n.props?.['aria-pressed'] === false).props.onClick();
  tree = render();
  assert.equal(byLabel(tree, 'Trang 1').props['aria-current'], 'page');
  byLabel(tree, 'Trang 3').props.onClick(); tree = render(products.slice(0, 1));
  assert.ok(nodes(tree).some(n => n.props?.title === 'Tác phẩm 00'));
  byLabel(tree, 'Tìm kiếm tác phẩm').props.onChange({ target: { value: 'impossible' } });
  tree = render();
  nodes(tree).find(n => n.type === 'button' && n.props.children === 'Xóa bộ lọc').props.onClick();
  tree = render();
  assert.equal(byLabel(tree, 'Tìm kiếm tác phẩm').props.value, '');
  assert.equal(byLabel(tree, 'Sắp xếp tác phẩm').props.value, 'relevance');
  assert.equal(byLabel(tree, 'Trang 1').props['aria-current'], 'page');
  assert.ok(nodes(tree).some(n => n.props?.['aria-pressed'] === false));
});
