const fixturePath = require.resolve('./fixtures.cjs');
const fixtures = require(fixturePath);

// Extend only this process's synthetic content; frozen measurement fixtures stay unchanged.
require.cache[fixturePath].exports = fixtures.map((product, index) => index === 0 ? {
  ...product,
  fullDescription: `${product.fullDescription}\nhttps://outside.example/article\nhttps://github.com/synthetic/preview-ok\nhttps://github.com/synthetic/preview-fails`,
} : product);

require('./server.cjs');
