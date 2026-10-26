import LinkPreview from '@/components/LinkPreview';
import { resolveEmbed } from '@/lib/embeds/resolve-embed';
import { defaultEmbedPlugins } from '@/lib/embeds/plugins';
import { EmbedPlugin } from '@/lib/embeds/types';
import { isAllowedPreviewHost } from '@/lib/preview-policy';

interface SmartEmbedProps {
  url: string;
  plugins?: EmbedPlugin[];
}

export default function SmartEmbed({ url, plugins = defaultEmbedPlugins }: SmartEmbedProps) {
  const embed = resolveEmbed(url, plugins);

  if (embed.type === 'iframe') {
    return (
      <div className="relative w-full overflow-hidden rounded-lg border border-[#D4C4A8] bg-black shadow-sm aspect-video">
        <iframe
          src={embed.src}
          title={embed.title}
          loading="lazy"
          allow={embed.allow}
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }

  let previewEnabled = false;
  try {
    previewEnabled = isAllowedPreviewHost(new URL(url).hostname);
  } catch {
    // Malformed URLs cannot request metadata.
  }

  return <LinkPreview key={url} url={url} previewEnabled={previewEnabled} />;
}
