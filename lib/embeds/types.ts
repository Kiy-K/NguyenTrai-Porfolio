export interface IframeEmbedConfig {
  type: 'iframe';
  src: string;
  title: string;
  allow?: string;
}

export interface PreviewEmbedConfig {
  type: 'preview';
}

export type EmbedConfig = IframeEmbedConfig | PreviewEmbedConfig;

export interface EmbedPlugin {
  id: string;
  canHandle(url: URL): boolean;
  resolve(url: URL): EmbedConfig | null;
}
