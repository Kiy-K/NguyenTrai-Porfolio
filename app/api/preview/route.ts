import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

interface PreviewPayload {
  url: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
}

interface CachedPreviewEntry {
  data: PreviewPayload;
  expiresAt: number;
}

const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_HTML_BYTES = 1024 * 1024;
const PREVIEW_USER_AGENT =
  'Mozilla/5.0 (compatible; NguyenTraiPortfolioPreviewBot/1.0; +https://example.com)';

const previewCache = new Map<string, CachedPreviewEntry>();

const getFirstNonEmpty = (...values: Array<string | undefined>): string | undefined => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
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

const getCachedPreview = (url: string): PreviewPayload | null => {
  const cached = previewCache.get(url);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    previewCache.delete(url);
    return null;
  }
  return cached.data;
};

const setCachedPreview = (url: string, data: PreviewPayload) => {
  previewCache.set(url, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get('url')?.trim();

  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url query parameter' }, { status: 400 });
  }

  const targetUrl = normalizeUrl(rawUrl);
  if (!targetUrl) {
    return NextResponse.json({ error: 'Invalid URL. Only http/https are supported.' }, { status: 400 });
  }

  const cached = getCachedPreview(targetUrl.toString());
  if (cached) {
    return NextResponse.json(cached, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=600',
      },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': PREVIEW_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Could not fetch target URL' }, { status: 502 });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      const fallback: PreviewPayload = {
        url: targetUrl.toString(),
        title: targetUrl.hostname,
        siteName: targetUrl.hostname,
      };
      setCachedPreview(targetUrl.toString(), fallback);
      return NextResponse.json(fallback);
    }

    const html = await response.text();
    const boundedHtml = html.length > MAX_HTML_BYTES ? html.slice(0, MAX_HTML_BYTES) : html;
    const $ = cheerio.load(boundedHtml);

    const title = getFirstNonEmpty(
      $('meta[property="og:title"]').attr('content'),
      $('meta[name="twitter:title"]').attr('content'),
      $('title').first().text(),
      targetUrl.hostname
    );

    const description = getFirstNonEmpty(
      $('meta[property="og:description"]').attr('content'),
      $('meta[name="twitter:description"]').attr('content'),
      $('meta[name="description"]').attr('content')
    );

    const image = toAbsoluteUrl(
      getFirstNonEmpty(
        $('meta[property="og:image"]').attr('content'),
        $('meta[name="twitter:image"]').attr('content')
      ),
      targetUrl
    );

    const siteName = getFirstNonEmpty(
      $('meta[property="og:site_name"]').attr('content'),
      targetUrl.hostname
    );

    const payload: PreviewPayload = {
      url: targetUrl.toString(),
      title: title || targetUrl.hostname,
      description,
      image,
      siteName,
    };

    setCachedPreview(targetUrl.toString(), payload);

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (error) {
    const isAbortError = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      {
        error: isAbortError ? 'Preview request timed out' : 'Failed to generate preview',
      },
      { status: 504 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
