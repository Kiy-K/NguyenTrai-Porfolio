const test = require('node:test');
const assert = require('node:assert/strict');
const sanitizeHtml = require('sanitize-html');

test('discarding deeply nested iframe fallback does not exhaust the stack', () => {
  // CVE-2026-113650: the feedback/preview plain-text policy must handle discarded iframe fallback safely.
  const options = { allowedTags: [], allowedAttributes: {}, disallowedTagsMode: 'discard', parser: { decodeEntities: true } };
  assert.doesNotThrow(() => sanitizeHtml('<iframe>'.repeat(2000), options));
  assert.equal(sanitizeHtml('<p>Nguyễn Trãi</p><script>alert(1)</script>', options), 'Nguyễn Trãi');
});
