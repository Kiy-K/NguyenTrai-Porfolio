const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const loadTs = require('./load-ts.cjs');
const constants = loadTs('lib/constants.ts');
const seo = loadTs('lib/seo.ts', { '@/lib/constants': constants });
const JsonLd = loadTs('components/JsonLd.tsx', { '@/lib/seo': seo }).default;
const origin = seo.PRODUCTION_ORIGIN;
const article = { id: 'bài viết & nguồn', title: 'Tư tưởng Nguyễn Trãi', description: 'Nội dung do tác giả viết.', images: ['https://example.org/image.jpg'], section: constants.SECTIONS[0].name };

test('home, section and article metadata use Vietnamese copy and canonical OG/Twitter URLs', () => {
  const cases = [
    [seo.homeMetadata(), '/', seo.SITE_TITLE, seo.SITE_DESCRIPTION, 'website'],
    [seo.sectionMetadata(constants.SECTIONS[0]), constants.SECTIONS[0].path, 'Tư tưởng nhân nghĩa | Nguyễn Trãi', 'Các bài viết trong chuyên mục Tư tưởng nhân nghĩa về Nguyễn Trãi.', 'website'],
    [seo.articleMetadata(article), '/products/' + encodeURIComponent(article.id), article.title + ' | Nguyễn Trãi', article.description, 'article'],
  ];
  for (const [metadata, path, title, description, type] of cases) {
    assert.equal(metadata.title, title);
    assert.equal(metadata.description, description);
    assert.equal(metadata.alternates.canonical, origin + path);
    assert.equal(metadata.openGraph.url, origin + path);
    assert.equal(metadata.openGraph.title, title);
    assert.equal(metadata.openGraph.description, description);
    assert.equal(metadata.openGraph.type, type);
    assert.equal(metadata.openGraph.locale, 'vi_VN');
    assert.equal(metadata.twitter.title, title);
    assert.equal(metadata.twitter.description, description);
    assert.deepEqual(metadata.robots, { index: true, follow: true });
  }
  assert.equal(seo.articleMetadata(article).twitter.card, 'summary_large_image');
});

test('sitemap excludes nonpublic/malformed data, deduplicates and encodes IDs on the production origin', () => {
  const inputs = [article, article, { ...article, id: 0, status: 'published' }, ...['draft', 'archived', null, 'unknown'].map(status => ({ ...article, status })), null, {}, { ...article, title: 123 }, { ...article, title: ' ' }, ...['', '.', '..', ' bad ', '\ud800'].map(id => ({ ...article, id })), { ...article, id: Infinity }];
  const entries = seo.buildSitemap(inputs);
  assert.equal(entries.length, constants.SECTIONS.length + 3);
  assert.ok(entries.some(entry => entry.url.endsWith('/products/0')));
  for (const entry of entries) {
    const url = new URL(entry.url);
    assert.equal(url.origin, origin);
    assert.doesNotMatch(url.pathname, /^\/(admin|api)(\/|$)/);
    assert.equal(entry.lastModified, undefined);
  }
});

test('creation dates never stand in for untracked publication or modification times', () => {
  for (const createdAt of ['2024-02-29T12:34:56Z', '2024-02-30T12:34:56Z', 'yesterday', undefined]) {
    const product = { ...article, createdAt };
    assert.equal(seo.buildSitemap([product]).at(-1).lastModified, undefined);
    assert.equal(seo.articleMetadata(product).openGraph.publishedTime, undefined);
    assert.equal(seo.articleStructuredData(product)[0].datePublished, undefined);
  }
});

test('missing descriptions/images and malformed optional stored fields are handled without fabricated copy', () => {
  const malformed = { ...article, description: null, fullDescription: 123, images: ['javascript:alert(1)', '//example.org/x', 'https://user:secret@example.org/a', null], section: 42 };
  const metadata = seo.articleMetadata(malformed);
  assert.equal(metadata.description, undefined);
  assert.deepEqual(metadata.openGraph.images, []);
  assert.equal(metadata.twitter.card, 'summary');
  const graph = seo.articleStructuredData(malformed);
  for (const key of ['description', 'image', 'author', 'datePublished', 'dateModified', 'citation', 'articleSection']) assert.equal(graph[0][key], undefined);
  assert.equal(seo.articleMetadata({ ...article, description: '', fullDescription: ' Nội dung\n tác giả ' }).description, 'Nội dung tác giả');
});

test('JSON-LD matches stored data and safely escapes script/HTML injection without losing text or references', () => {
  const title = '</script><img src=x onerror=alert(1)><!--';
  const product = { ...article, title, references: [{ title: 'Nguồn in', author: 'Người viết nguồn' }] };
  const before = structuredClone(product);
  const graph = seo.articleStructuredData(product);
  const html = renderToStaticMarkup(JsonLd({ data: graph }));
  assert.equal((html.match(/<script/g) || []).length, 1);
  assert.doesNotMatch(html, /<img|<!--/);
  const parsed = JSON.parse(html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>')));
  assert.equal(parsed[0].headline, title);
  assert.equal(parsed[0]['@type'], 'Article');
  assert.equal(parsed[1].itemListElement[1].name, article.section);
  assert.equal(parsed[1].itemListElement.at(-1).item, origin + seo.articlePath(product));
  assert.equal(parsed[0].author, undefined);
  assert.deepEqual(product, before);
});

test('robots discourages admin/API crawling and links the canonical sitemap', () => {
  const robots = loadTs('app/robots.ts', { '@/lib/seo': seo }).default();
  assert.deepEqual(robots, { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }, sitemap: origin + '/sitemap.xml' });
});

test('sitemap calls public reads and propagates backend errors without emitting source data', async () => {
  const route = getProducts => loadTs('app/sitemap.ts', { '@/lib/data': { getProducts }, '@/lib/seo': seo });
  assert.equal(route(async () => []).dynamic, 'force-dynamic');
  assert.deepEqual(await route(async () => [article]).default(), seo.buildSitemap([article]));
  await assert.rejects(route(async () => { throw Error('backend failed'); }).default(), /backend failed/);
});

test('page metadata rejects missing, unpublished and malformed articles, and unknown sections', async () => {
  const mocks = { '@/lib/seo': seo, '@/components/JsonLd': {}, '@/components/ContentSkeletons': {}, '@/lib/data': {}, '@/data/products': {}, '@/components/ShareButton': {}, '@/components/VideoPlayer': {}, '@/components/MuxVideoPlayer': {}, '@/components/BackButton': {}, '@/components/RichTextWithEmbeds': {}, '@/components/SmartEmbed': {}, '@/components/ArticleReferences': {}, '@/lib/url-parser': {}, 'next/navigation': { notFound: () => { throw Error('NOT_FOUND'); } } };
  for (const product of [undefined, { ...article, status: 'draft' }, { ...article, status: 'archived' }, { ...article, title: null }, { ...article, videos: {} }]) {
    const page = loadTs('app/(public)/products/[id]/page.tsx', { ...mocks, '@/lib/data': { getProduct: async () => product } });
    await assert.rejects(page.generateMetadata({ params: Promise.resolve({ id: 'missing' }) }), /NOT_FOUND/);
  }
  const page = loadTs('app/(public)/products/[id]/page.tsx', { ...mocks, '@/lib/data': { getProduct: async () => article } });
  assert.deepEqual(await page.generateMetadata({ params: Promise.resolve({ id: article.id }) }), seo.articleMetadata(article));
  const section = loadTs('app/(public)/sections/[id]/page.tsx', { ...mocks, '@/lib/constants': constants, '@/components/Footer': {}, '@/components/ProjectList': {} });
  await assert.rejects(section.generateMetadata({ params: Promise.resolve({ id: 'missing' }) }), /NOT_FOUND/);
  assert.deepEqual(await section.generateMetadata({ params: Promise.resolve({ id: constants.SECTIONS[0].id }) }), seo.sectionMetadata(constants.SECTIONS[0]));
});


test('malformed renderer fields are neither advertised nor rendered, while safe legacy references stay eligible', async () => {
  const malformed = [{ videos: {} }, { videos: [null] }, { videos: [{ muxPlaybackId: 1 }] }, { images: {} }, { images: [{}] }, { images: ['not-a-url'] }, { images: ['//example.org/x'] }, { images: ['javascript:alert(1)'] }, { images: ['\ud800'] }, { tags: {} }, { tags: [{}] }, { description: {} }, { fullDescription: 123 }, { references: [null] }, { references: [{ title: {} }] }, { references: { length: 1 } }];
  for (const fields of malformed) {
    const product = { ...article, ...fields };
    assert.equal(seo.isDiscoverableArticle(product), false);
    assert.deepEqual(seo.buildSitemap([product]), seo.buildSitemap([]));
    const page = loadTs('app/(public)/products/[id]/page.tsx', {
      '@/lib/seo': seo, '@/components/JsonLd': {}, '@/components/ContentSkeletons': {},
      '@/lib/data': { getProduct: async () => product }, '@/data/products': {},
      '@/components/ShareButton': {}, '@/components/VideoPlayer': {}, '@/components/MuxVideoPlayer': {},
      '@/components/BackButton': () => null, '@/components/RichTextWithEmbeds': {}, '@/components/SmartEmbed': {},
      '@/components/ArticleReferences': {}, '@/lib/url-parser': {},
      'next/navigation': { notFound: () => { throw Error('NOT_FOUND'); } },
    });
    const shell = await page.default({ params: Promise.resolve({ id: article.id }) });
    const suspense = shell.props.children.props.children[1];
    await assert.rejects(suspense.props.children.type(suspense.props.children.props), /NOT_FOUND/);
  }
  assert.equal(seo.isDiscoverableArticle({ ...article, references: [{ title: 'Unsafe legacy URL stays displayable', url: 'javascript:alert(1)' }] }), true);
});


test('advertised legacy local image sources render through real next/image', () => {
  const Image = require('next/image').default;
  for (const src of ['/nguyen-trai.jpg', '/image%20name.jpg']) {
    assert.equal(seo.isDiscoverableArticle({ ...article, images: [src] }), true);
    assert.match(renderToStaticMarkup(require('react').createElement(Image, { src, alt: article.title, width: 100, height: 100 })), /<img/);
  }
});
