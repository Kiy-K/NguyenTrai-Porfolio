const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { renderToStaticMarkup } = require('react-dom/server');
const loadTs = require('./load-ts.cjs');

test('retired summary UI and endpoint are absent', () => {
  assert.equal(fs.existsSync('components/SummarizeButton.tsx'), false);
  assert.equal(fs.existsSync('app/api/get-summary/route.ts'), false);
});

test('cards retain authored description, media and navigation without summary controls', () => {
  const link = props => require('react').createElement('a', props);
  const image = ({ src, alt }) => require('react').createElement('img', { src, alt });
  const mocks = {
    'next/link': { default: link },
    'next/image': { default: image },
    '@/components/ShareButton': { default: () => require('react').createElement('button', null, 'Chia sẻ') },
  };
  const { default: ProjectCard } = loadTs('components/ProjectCard.tsx', mocks);
  const { default: ProductCard } = loadTs('components/ProductCard.tsx', mocks);
  const product = { id: 'original-id', title: 'Nguyễn Trãi', description: 'Mô tả nguyên bản do tác giả viết.', images: ['/nguyen-trai.jpg'] };
  for (const html of [renderToStaticMarkup(ProjectCard({ ...product, imageUrl: product.images[0] })), renderToStaticMarkup(ProductCard({ product }))]) {
    assert.match(html, /Mô tả nguyên bản do tác giả viết/);
    assert.match(html, /href="\/products\/original-id"/);
    assert.match(html, /src="\/nguyen-trai.jpg"/);
    assert.doesNotMatch(html, /Tóm tắt bằng AI/);
  }
  assert.match(renderToStaticMarkup(ProjectCard(product)), /Chia sẻ/);
});
