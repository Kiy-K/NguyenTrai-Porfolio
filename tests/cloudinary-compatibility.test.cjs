const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getCldImageUrl, getCldVideoUrl } = require('next-cloudinary');
const config = { cloud: { cloudName: 'demo' } };

test('patched Cloudinary loader preserves image and legacy video URLs', () => {
  const cases = [
    [getCldImageUrl, { src: 'sample', width: 192, height: 192, crop: 'fill' }, '/demo/image/upload/c_fill,w_192,h_192,g_auto/f_auto/q_auto/v1/sample'],
    [getCldVideoUrl, { src: 'dog', width: 1920, height: 1080 }, '/demo/video/upload/c_limit,w_1920/f_auto:video/q_auto/v1/dog'],
    [getCldVideoUrl, { src: 'https://res.cloudinary.com/demo/video/upload/v123/dog.mp4', width: 1920, height: 1080 }, '/demo/video/upload/c_limit,w_1920/f_auto:video/q_auto/v123/dog'],
  ];
  for (const [generate, options, pathname] of cases) {
    const url = new URL(generate(options, config));
    assert.equal(url.origin, 'https://res.cloudinary.com');
    assert.equal(url.pathname, pathname);
  }
});

test('patched loader preserves the options used by the legacy video player', () => {
  const { getVideoPlayerOptions } = require('@cloudinary-util/url-loader');
  const options = getVideoPlayerOptions({
    src: 'https://res.cloudinary.com/demo/video/upload/v123/folder/clip.mp4',
    width: '1920', height: '1080', id: 'video-player-fixture', className: 'w-full h-full object-cover',
  }, config);
  assert.deepEqual(options, {
    cloud_name: 'demo', privateCdn: undefined, secureDistribution: undefined,
    autoplayMode: undefined, autoplay: false, controls: true, language: undefined, languages: undefined,
    loop: false, muted: false, publicId: 'folder/clip', transformation: [{ quality: 'auto' }, undefined],
    showLogo: true, width: '1920', height: '1080', id: 'video-player-fixture',
    className: 'w-full h-full object-cover', aspectRatio: '1920:1080',
  });
  assert.equal(options.posterOptions, undefined);
});
