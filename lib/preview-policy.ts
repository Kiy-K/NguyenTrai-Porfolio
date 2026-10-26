const DEFAULT_ALLOWED_PREVIEW_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'wikipedia.org',
  'wikimedia.org',
  'vnexpress.net',
  'tuoitre.vn',
  'thanhnien.vn',
  'dantri.com.vn',
  'github.com',
  'medium.com',
] as const;

const parseAllowedPreviewDomains = (): string[] => {
  const fromEnv = (process.env.PREVIEW_ALLOWED_DOMAINS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => value.replace(/^\./, ''));

  if (fromEnv.length > 0) {
    return [...new Set(fromEnv)];
  }

  return [...DEFAULT_ALLOWED_PREVIEW_DOMAINS];
};

const ALLOWED_PREVIEW_DOMAINS = parseAllowedPreviewDomains();

export const isAllowedPreviewHost = (host: string): boolean => {
  const normalized = host.toLowerCase();
  return ALLOWED_PREVIEW_DOMAINS.some(
    (allowedDomain) => normalized === allowedDomain || normalized.endsWith(`.${allowedDomain}`)
  );
};
