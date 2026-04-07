import { defaultEmbedPlugins } from '@/lib/embeds/plugins';
import { EmbedConfig, EmbedPlugin } from '@/lib/embeds/types';

const PREVIEW_FALLBACK: EmbedConfig = { type: 'preview' };

const normalizeUrl = (rawUrl: string): URL | null => {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export function resolveEmbed(url: string, plugins: EmbedPlugin[] = defaultEmbedPlugins): EmbedConfig {
  const parsedUrl = normalizeUrl(url);
  if (!parsedUrl) return PREVIEW_FALLBACK;

  for (const plugin of plugins) {
    if (!plugin.canHandle(parsedUrl)) continue;
    const resolved = plugin.resolve(parsedUrl);
    if (resolved) return resolved;
  }

  return PREVIEW_FALLBACK;
}
