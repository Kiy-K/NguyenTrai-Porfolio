import { EmbedPlugin } from '@/lib/embeds/types';

const DEFAULT_IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

const getYouTubeVideoId = (url: URL): string | null => {
  if (url.hostname === 'youtu.be' || url.hostname === 'www.youtu.be') {
    return url.pathname.split('/').filter(Boolean)[0] || null;
  }

  if (url.pathname === '/watch') {
    return url.searchParams.get('v');
  }

  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'embed' || pathParts[0] === 'shorts') {
    return pathParts[1] || null;
  }

  return null;
};

const getVimeoVideoId = (url: URL): string | null => {
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length === 0) return null;

  if (pathParts[0] === 'video') {
    return /^\d+$/.test(pathParts[1] || '') ? pathParts[1] : null;
  }

  return /^\d+$/.test(pathParts[0]) ? pathParts[0] : null;
};

export const youtubeEmbedPlugin: EmbedPlugin = {
  id: 'youtube',
  canHandle(url) {
    return YOUTUBE_HOSTS.has(url.hostname);
  },
  resolve(url) {
    const id = getYouTubeVideoId(url);
    if (!id) return null;
    return {
      type: 'iframe',
      src: `https://www.youtube-nocookie.com/embed/${id}`,
      title: 'youtube embed',
      allow: DEFAULT_IFRAME_ALLOW,
    };
  },
};

export const vimeoEmbedPlugin: EmbedPlugin = {
  id: 'vimeo',
  canHandle(url) {
    return VIMEO_HOSTS.has(url.hostname);
  },
  resolve(url) {
    const id = getVimeoVideoId(url);
    if (!id) return null;
    return {
      type: 'iframe',
      src: `https://player.vimeo.com/video/${id}`,
      title: 'vimeo embed',
      allow: DEFAULT_IFRAME_ALLOW,
    };
  },
};

export const defaultEmbedPlugins: EmbedPlugin[] = [youtubeEmbedPlugin, vimeoEmbedPlugin];
