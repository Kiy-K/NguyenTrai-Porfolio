import { NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import { consumeRateLimit } from '@/lib/rate-limit';
import { getClientIpFromHeaders } from '@/lib/admin-auth';

interface PreviewPayload {
  url: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
}

const REQUEST_TIMEOUT_MS = 4_500;
const MAX_HTML_BYTES = 50 * 1024;
const REVALIDATE_SECONDS = 3600;
const CACHE_CONTROL_HEADER = 'public, s-maxage=3600, stale-while-revalidate=86400';
const PREVIEW_USER_AGENT =
  'Mozilla/5.0 (compatible; NguyenTraiPortfolioPreviewBot/1.0; +https://example.com)';
const MAX_REDIRECTS = 5;
const PREVIEW_RATE_LIMIT = { limit: 60, windowSeconds: 60 };

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

const BLOCKED_HOSTNAMES = new Set(['localhost']);

const IPV4_BLOCKED_CIDRS: Array<[number, number]> = [
  [ipV4ToInt('0.0.0.0'), 8],
  [ipV4ToInt('10.0.0.0'), 8],
  [ipV4ToInt('100.64.0.0'), 10],
  [ipV4ToInt('127.0.0.0'), 8],
  [ipV4ToInt('169.254.0.0'), 16],
  [ipV4ToInt('172.16.0.0'), 12],
  [ipV4ToInt('192.0.0.0'), 24],
  [ipV4ToInt('192.0.2.0'), 24],
  [ipV4ToInt('192.88.99.0'), 24],
  [ipV4ToInt('192.168.0.0'), 16],
  [ipV4ToInt('198.18.0.0'), 15],
  [ipV4ToInt('198.51.100.0'), 24],
  [ipV4ToInt('203.0.113.0'), 24],
  [ipV4ToInt('224.0.0.0'), 4],
];

const previewQuerySchema = z.object({
  url: z.string().trim().url().max(2048),
});

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

const getFirstNonEmpty = (...values: Array<string | undefined>): string | undefined => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const sanitizeMetadataText = (value: string): string =>
  normalizeWhitespace(
    sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'discard',
      parser: { decodeEntities: true },
    })
  );

const parseHtmlAttributes = (tag: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  const attrRegex = /([^\s"'=<>`/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(tag)) !== null) {
    const key = match[1].toLowerCase();
    const value = (match[2] ?? match[3] ?? match[4] ?? '').trim();
    attributes[key] = value;
  }
  return attributes;
};

const findMetaContent = (
  html: string,
  attributeName: 'property' | 'name',
  attributeValue: string
): string | undefined => {
  const metaRegex = /<meta\b[^>]*>/gi;
  let metaMatch: RegExpExecArray | null;
  const targetName = attributeName.toLowerCase();
  const targetValue = attributeValue.toLowerCase();

  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const attributes = parseHtmlAttributes(metaMatch[0]);
    const currentName = attributes[targetName]?.toLowerCase();
    if (currentName !== targetValue) continue;

    const content = attributes.content;
    if (content) return sanitizeMetadataText(content);
  }

  return undefined;
};

const findTitleText = (html: string): string | undefined => {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch?.[1]) return undefined;

  return sanitizeMetadataText(titleMatch[1]);
};

function ipV4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    throw new Error('Invalid IPv4 address');
  }
  return (((parts[0] << 24) >>> 0) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

const isIpInCidrV4 = (ip: string, base: number, prefixLength: number): boolean => {
  const value = ipV4ToInt(ip);
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (value & mask) === (base & mask);
};

const parseEmbeddedV4InIpv6 = (value: string): [number, number] | null => {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const parsed = parts.map((part) => Number(part));
  if (parsed.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return null;
  return [((parsed[0] << 8) | parsed[1]) >>> 0, ((parsed[2] << 8) | parsed[3]) >>> 0];
};

const expandIpv6 = (ip: string): number[] | null => {
  const normalized = ip.toLowerCase();
  const doubleColonCount = normalized.split('::').length - 1;
  if (doubleColonCount > 1) return null;

  let left = '';
  let right = '';
  if (doubleColonCount === 1) {
    [left, right] = normalized.split('::');
  } else {
    left = normalized;
  }

  const leftParts = left ? left.split(':').filter(Boolean) : [];
  const rightParts = right ? right.split(':').filter(Boolean) : [];

  const convertPart = (part: string): number[] | null => {
    if (!part) return [];
    if (part.includes('.')) {
      const embedded = parseEmbeddedV4InIpv6(part);
      return embedded ? [embedded[0], embedded[1]] : null;
    }
    const value = Number.parseInt(part, 16);
    if (Number.isNaN(value) || value < 0 || value > 0xffff) return null;
    return [value];
  };

  const leftExpanded: number[] = [];
  for (const part of leftParts) {
    const values = convertPart(part);
    if (!values) return null;
    leftExpanded.push(...values);
  }

  const rightExpanded: number[] = [];
  for (const part of rightParts) {
    const values = convertPart(part);
    if (!values) return null;
    rightExpanded.push(...values);
  }

  if (doubleColonCount === 0 && leftExpanded.length !== 8) return null;
  if (leftExpanded.length + rightExpanded.length > 8) return null;

  const zeroCount = 8 - leftExpanded.length - rightExpanded.length;
  return [...leftExpanded, ...new Array(zeroCount).fill(0), ...rightExpanded];
};

const isBlockedIpv4 = (ip: string): boolean => {
  for (const [base, prefixLength] of IPV4_BLOCKED_CIDRS) {
    if (isIpInCidrV4(ip, base, prefixLength)) {
      return true;
    }
  }
  return false;
};

const isBlockedIpv6 = (ip: string): boolean => {
  const expanded = expandIpv6(ip);
  if (!expanded) return true;

  const [first, second, third, fourth, fifth, sixth, seventh, eighth] = expanded;
  const isUnspecified = expanded.every((part) => part === 0);
  if (isUnspecified) return true;
  if (first === 0 && second === 0 && third === 0 && fourth === 0 && fifth === 0 && sixth === 0 && seventh === 0 && eighth === 1) {
    return true;
  }
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xffc0) === 0xfec0) return true;
  if (first === 0x2001 && second === 0x0db8) return true;

  if (
    first === 0 &&
    second === 0 &&
    third === 0 &&
    fourth === 0 &&
    fifth === 0 &&
    sixth === 0xffff
  ) {
    const mapped = `${seventh >> 8}.${seventh & 0xff}.${eighth >> 8}.${eighth & 0xff}`;
    return isBlockedIpv4(mapped);
  }

  return false;
};

const isBlockedHost = (host: string): boolean => {
  const normalized = host.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(normalized)) return true;
  if (normalized.endsWith('.localhost')) return true;
  if (normalized.endsWith('.local')) return true;
  if (normalized.endsWith('.internal')) return true;
  if (normalized.endsWith('.home.arpa')) return true;
  return false;
};

const isAllowedHost = (host: string): boolean => {
  const normalized = host.toLowerCase();
  return ALLOWED_PREVIEW_DOMAINS.some(
    (allowedDomain) => normalized === allowedDomain || normalized.endsWith(`.${allowedDomain}`)
  );
};

const assertSafeTargetUrl = async (url: URL): Promise<void> => {
  if (url.username || url.password) {
    throw new Error('URL credentials are not allowed');
  }

  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new Error('Target port is not allowed');
  }

  const hostname = url.hostname.trim();
  if (!hostname || isBlockedHost(hostname)) {
    throw new Error('Target host is not allowed');
  }

  if (!isAllowedHost(hostname)) {
    throw new Error('Target host is outside the preview allowlist');
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4 && isBlockedIpv4(hostname)) {
    throw new Error('Target IP is not allowed');
  }
  if (ipVersion === 6 && isBlockedIpv6(hostname)) {
    throw new Error('Target IP is not allowed');
  }

  if (ipVersion === 0) {
    const resolved = await lookup(hostname, { all: true, verbatim: true });
    if (resolved.length === 0) {
      throw new Error('Unable to resolve target host');
    }
    for (const record of resolved) {
      if ((record.family === 4 && isBlockedIpv4(record.address)) || (record.family === 6 && isBlockedIpv6(record.address))) {
        throw new Error('Target host resolves to a restricted IP');
      }
    }
  }
};

const fetchWithSafeRedirects = async (
  initialUrl: URL,
  signal: AbortSignal
): Promise<{ response: Response; finalUrl: URL }> => {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    await assertSafeTargetUrl(currentUrl);

    const response = await fetch(currentUrl, {
      method: 'GET',
      headers: {
        'User-Agent': PREVIEW_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'manual',
      signal,
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('Redirect missing location header');
      }

      const nextUrl = normalizeUrl(new URL(location, currentUrl).toString());
      if (!nextUrl) {
        throw new Error('Redirect target URL is invalid');
      }

      currentUrl = nextUrl;
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error('Too many redirects');
};

const normalizeUrl = (rawUrl: string): URL | null => {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const toAbsoluteUrl = (candidateUrl: string | undefined, baseUrl: URL): string | undefined => {
  if (!candidateUrl) return undefined;
  try {
    return new URL(candidateUrl, baseUrl).toString();
  } catch {
    return undefined;
  }
};

const withCacheHeader = (status = 200, extraHeaders: Record<string, string> = {}) => ({
  status,
  headers: {
    'Cache-Control': CACHE_CONTROL_HEADER,
    ...extraHeaders,
  },
});

const readBoundedHtml = async (response: Response, maxBytes: number): Promise<string> => {
  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;

      const remaining = maxBytes - total;
      const chunk = value.length > remaining ? value.slice(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.length;

      if (value.length > remaining) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  if (chunks.length === 0) return '';

  const boundedBytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    boundedBytes.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder('utf-8').decode(boundedBytes);
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedQuery = previewQuerySchema.safeParse({
    url: searchParams.get('url')?.trim(),
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'Invalid URL. Only http/https are supported.' },
      withCacheHeader(400)
    );
  }

  const ip = getClientIpFromHeaders(request.headers);
  try {
    const rateLimit = await consumeRateLimit({
      key: `preview:${ip}`,
      ...PREVIEW_RATE_LIMIT,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many preview requests. Please retry later.' },
        withCacheHeader(429, { 'Retry-After': String(rateLimit.retryAfterSeconds) })
      );
    }
  } catch {
    // Keep preview endpoint available even if Redis is unavailable.
  }

  const targetUrl = normalizeUrl(parsedQuery.data.url);
  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Invalid URL. Only http/https are supported.' },
      withCacheHeader(400)
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    await assertSafeTargetUrl(targetUrl);
    const { response, finalUrl } = await fetchWithSafeRedirects(targetUrl, controller.signal);

    if (!response.ok) {
      return NextResponse.json({ error: 'Could not fetch target URL' }, withCacheHeader(502));
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      const fallback: PreviewPayload = {
        url: finalUrl.toString(),
        title: finalUrl.hostname,
        siteName: finalUrl.hostname,
      };
      return NextResponse.json(fallback, withCacheHeader());
    }

    const boundedHtml = await readBoundedHtml(response, MAX_HTML_BYTES);

    const title = getFirstNonEmpty(
      findMetaContent(boundedHtml, 'property', 'og:title'),
      findMetaContent(boundedHtml, 'name', 'twitter:title'),
      findTitleText(boundedHtml),
      finalUrl.hostname
    );

    const description = getFirstNonEmpty(
      findMetaContent(boundedHtml, 'property', 'og:description'),
      findMetaContent(boundedHtml, 'name', 'twitter:description'),
      findMetaContent(boundedHtml, 'name', 'description')
    );

    const image = toAbsoluteUrl(
      getFirstNonEmpty(
        findMetaContent(boundedHtml, 'property', 'og:image'),
        findMetaContent(boundedHtml, 'name', 'twitter:image')
      ),
      finalUrl
    );

    const siteName = getFirstNonEmpty(
      findMetaContent(boundedHtml, 'property', 'og:site_name'),
      finalUrl.hostname
    );

    const payload: PreviewPayload = {
      url: finalUrl.toString(),
      title: title || finalUrl.hostname,
      description,
      image,
      siteName,
    };

    return NextResponse.json(payload, withCacheHeader());
  } catch (error) {
    const isAbortError = error instanceof Error && error.name === 'AbortError';
    const isValidationError =
      error instanceof Error &&
      (error.message.includes('not allowed') ||
        error.message.includes('restricted') ||
        error.message.includes('invalid') ||
        error.message.includes('resolve') ||
        error.message.includes('allowlist') ||
        error.message.includes('port'));
    return NextResponse.json(
      {
        error: isAbortError
          ? 'Preview request timed out'
          : isValidationError
            ? 'Target URL is not allowed'
            : 'Failed to generate preview',
      },
      withCacheHeader(isValidationError ? 400 : 504)
    );
  } finally {
    clearTimeout(timeout);
  }
}
