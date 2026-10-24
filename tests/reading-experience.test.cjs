const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const loadTs = require('./load-ts.cjs');
const constants = loadTs('lib/constants.ts');
const seo = loadTs('lib/seo.ts', { '@/lib/constants': constants });
const { relatedArticles } = loadTs('lib/related-articles.ts', { '@/lib/seo': seo });
const BreadcrumbNav = loadTs('components/BreadcrumbNav.tsx').default;
const RelatedArticles = loadTs('components/RelatedArticles.tsx', { '@/lib/seo': seo }).default;
const article = (id, fields = {}) => ({ id, title: 'Bài viết', description: 'Nội dung', images: [], section: constants.SECTIONS[0].name, ...fields });
const ids = items => items.map(item => item.id);

test('known, unknown and legacy default breadcrumb data matches the P6 graph', () => {
  for (const section of [constants.SECTIONS[0].name.toUpperCase(), undefined, null, '', 'Unknown']) {
    const product = article('a & / b', { section, title: '  Tên\n bài viết  ' });
    const items = seo.articleBreadcrumbs(product);
    assert.equal(items.length, section === 'Unknown' ? 1 : 2);
    assert.deepEqual(seo.articleStructuredData(product)[1], seo.breadcrumbs(items));
    assert.equal(items.at(-1).path, '/products/a%20%26%20%2F%20b');
    assert.equal(items.at(-1).name, 'Tên bài viết');
    if (section !== 'Unknown') assert.equal(items[0].path, '/sections/tu-tuong-nhan-nghia');
  }
  assert.equal(seo.articleSection(article('a', { section: 'unknown' })), undefined);
});

test('breadcrumb and related markup escapes XSS, preserves accessible names and safe encoded links', () => {
  const product = article('a/<>', { title: '</script><img src=x onerror=alert(1)>' });
  const html = renderToStaticMarkup(React.createElement(BreadcrumbNav, { items: seo.articleBreadcrumbs(product) }));
  assert.match(html, /<nav aria-label="Đường dẫn trang"/);
  assert.match(html, /<ol/);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /href="\/sections\/tu-tuong-nhan-nghia"/);
  const cards = renderToStaticMarkup(React.createElement(RelatedArticles, { products: [product] }));
  assert.match(cards, /href="\/products\/a%2F%3C%3E"/);
  assert.doesNotMatch(cards, /<img|<script|<video/);
  assert.equal(renderToStaticMarkup(React.createElement(RelatedArticles, { products: [] })), '');
});

test('empty, single-item and irrelevant datasets omit recommendations; default section is relevant', () => {
  const current = article('self');
  for (const dataset of [[], [current], [article('unrelated', { section: 'unknown' })]]) assert.deepEqual(relatedArticles(current, dataset), []);
  assert.deepEqual(ids(relatedArticles(current, [article('legacy', { section: undefined })])), ['legacy']);
  assert.deepEqual(relatedArticles(article('self', { section: 'unknown' }), [article('other', { section: 'unknown' })]), []);
});

test('same configured section wins, then shared unique normalized tags, then Vietnamese title and ID; max three', () => {
  const current = article('self', { tags: ['VĂN HỌC', 'ĐẠO ĐỨC'] });
  const dataset = [
    article('backfill', { section: 'unknown', tags: ['van hoc', 'dao duc'] }),
    article('z', { title: 'An' }), article('b', { title: 'Bình', tags: ['Văn Học', 'văn học'] }),
    article('a', { title: 'Bình', tags: ['  van   hoc '] }),
    article('first', { title: 'Cuối', tags: ['Va\u0306n ho\u0323c', 'dao duc'] }),
  ];
  const snapshot = structuredClone(dataset);
  assert.deepEqual(ids(relatedArticles(current, dataset)), ['first', 'a', 'b']);
  assert.deepEqual(ids(relatedArticles(current, [...dataset].reverse())), ['first', 'a', 'b']);
  assert.deepEqual(dataset, snapshot);
  assert.deepEqual(ids(relatedArticles(current, [dataset[0], dataset[1]])), ['z', 'backfill']);
  assert.deepEqual(ids(relatedArticles(article('self', { section: 'unknown', tags: ['đạo đức'] }), [dataset[0]])), ['backfill']);
});

test('excludes current numeric/string IDs, duplicate routes, invalid images and private/malformed records', () => {
  const current = article(1);
  const badFields = [{ status: 'draft' }, { status: 'archived' }, { status: null }, { status: 'unknown' }, { title: '' }, { title: {} }, { images: ['javascript:alert(1)'] }, { images: ['//example.org/x'] }, { images: [null] }, { videos: {} }, { tags: [null] }, { references: [null] }];
  const inputs = [current, article('1'), null, {}, article('\ud800'), ...badFields.map((fields, i) => article(`bad-${i}`, fields)), article(2), article('2'), article('ok', { status: 'published' })];
  assert.deepEqual(ids(relatedArticles(current, inputs)), [2, 'ok']);
  assert.deepEqual(relatedArticles(article('private', { status: 'draft' }), inputs), []);
  assert.deepEqual(relatedArticles(current, [article('shadow', { images: ['bad'] }), article('shadow')]), []);
});

test('article body and related cards share one list read and gate invalid records before navigation', async () => {
  let reads = 0;
  let products = [article('self'), article('other')];
  const page = loadTs('app/(public)/products/[id]/page.tsx', {
    '@/lib/seo': seo, '@/lib/related-articles': { relatedArticles },
    '@/lib/data': { getProducts: async () => { reads++; return products; } },
    '@/components/BreadcrumbNav': BreadcrumbNav, '@/components/RelatedArticles': RelatedArticles,
    '@/components/JsonLd': {}, '@/components/ContentSkeletons': {}, '@/components/BackButton': {},
    '@/components/ShareButton': {}, '@/components/VideoPlayer': {}, '@/components/MuxVideoPlayer': {},
    '@/components/RichTextWithEmbeds': {}, '@/components/SmartEmbed': {}, '@/components/ArticleReferences': {},
    '@/lib/url-parser': { parseTextWithUrls: () => [] },
    'next/navigation': { notFound: () => { throw Error('NOT_FOUND'); } },
  });
  const shell = await page.default({ params: Promise.resolve({ id: new String('self') }) });
  const content = shell.props.children.props.children[1].props.children;
  const rendered = await content.type(content.props);
  assert.equal(reads, 1);
  assert.deepEqual(rendered.props.children[0].props.items, seo.articleBreadcrumbs(products[0]));
  for (const invalid of [undefined, article('self', { status: 'draft' }), article('self', { images: ['bad'] })]) {
    products = invalid ? [invalid] : [];
    await assert.rejects(content.type(content.props), /NOT_FOUND/);
  }
});
