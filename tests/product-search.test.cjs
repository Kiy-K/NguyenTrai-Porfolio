const { test } = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const MiniSearch = require('minisearch');
const { createProductSearch, findProducts, normalizeSearchText } = loadTs('lib/product-search.ts', {
  minisearch: { default: MiniSearch },
});
const product = (id, title, extra = {}) => ({ id, title, description: '', images: [], ...extra });
const products = [
  product('title', 'Nguyễn Trãi', { tags: ['Văn học'], section: 'Tư tưởng nhân nghĩa' }),
  product('description', 'Một bài viết khác', { description: 'Nguyễn Trãi và nhân nghĩa' }),
  product('draft', 'Nguyễn Trãi bản nháp', { status: 'draft', tags: ['Riêng tư'] }),
  product('archived', 'Nguyễn Trãi lưu trữ', { status: 'archived' }),
  product(5, 'Đại cáo bình Ngô', { status: 'published', tags: ['Văn học', 'Lịch sử'] }),
];
const ids = results => results.map(p => p.id);

test('Vietnamese folding includes đ and decomposed accents', () => {
  assert.equal(normalizeSearchText('ĐẠI Nguyễn Trãi'.normalize('NFD')), 'dai nguyen trai');
  const search = createProductSearch(products);
  assert.deepEqual(ids(findProducts(search, 'Nguyễn Trãi')), ids(findProducts(search, 'nguyen trai')));
  assert.deepEqual(ids(findProducts(search, 'nhân nghĩa')), ids(findProducts(search, 'nhan nghia')));
  assert.deepEqual(ids(findProducts(search, 'dai cao')), [5]);
});

test('search is local without keys/network, public-only, and leaves originals untouched', () => {
  const original = JSON.stringify(products);
  const fetchBefore = global.fetch;
  global.fetch = () => { throw Error('search must not call a network'); };
  try {
    const search = createProductSearch(products);
    assert.equal(search.index.documentCount, 3);
    assert.equal(JSON.stringify(search.index).includes('nhap'), false);
    assert.equal(findProducts(search, 'nguyen trai')[0], products[0]);
    assert.deepEqual(ids(findProducts(search, 'rieng tu')), []);
    assert.equal(JSON.stringify(products), original);
  } finally { global.fetch = fetchBefore; }
});

test('prefixes and one-edit typos work, short fuzzy and permissive OR do not', () => {
  const search = createProductSearch(products);
  assert.equal(ids(findProducts(search, 'nguy tra'))[0], 'title');
  assert.equal(ids(findProducts(search, 'nguyem trai'))[0], 'title');
  assert.deepEqual(ids(findProducts(search, 'nguyen impossible')), []);
  assert.deepEqual(ids(findProducts(search, 'x')), []);
  assert.deepEqual(ids(findProducts(search, 'traii')), ['title', 'description']);
  assert.deepEqual(ids(findProducts(search, '!!!')), []);
});

test('title ranks ahead of description; tag intersections and section terms work', () => {
  const search = createProductSearch(products);
  assert.deepEqual(ids(findProducts(search, 'nguyen trai')), ['title', 'description']);
  assert.deepEqual(ids(findProducts(search, 'van hoc', 'title-asc')), [5, 'title']);
  assert.deepEqual(ids(findProducts(search, '', 'relevance', ['Văn học', 'Lịch sử'])), [5]);
  assert.deepEqual(ids(findProducts(search, 'nhan nghia', 'relevance', ['Văn học'])), ['title']);
});

test('sorts deterministically by relevance, explicit title, then ID', () => {
  const search = createProductSearch([product('b', 'Trãi'), product('a', 'Trãi'), product('c', 'An Trãi')]);
  assert.deepEqual(ids(findProducts(search, 'trai')), ['a', 'b', 'c']);
  assert.deepEqual(ids(findProducts(search, 'trai', 'title-asc')), ['c', 'a', 'b']);
  assert.deepEqual(ids(findProducts(search, 'trai', 'title-desc')), ['a', 'b', 'c']);
  assert.deepEqual(ids(findProducts(search, '')), ['c', 'a', 'b']);
});
