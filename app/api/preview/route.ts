import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

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

const withCacheHeader = (status = 200) => ({
  status,
  headers: {
    'Cache-Control': CACHE_CONTROL_HEADER,
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
  const rawUrl = searchParams.get('url')?.trim();

  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url query parameter' }, withCacheHeader(400));
  }

  const targetUrl = normalizeUrl(rawUrl);
  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Invalid URL. Only http/https are supported.' },
      withCacheHeader(400)
    );
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
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Could not fetch target URL' }, withCacheHeader(502));
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      const fallback: PreviewPayload = {
        url: targetUrl.toString(),
        title: targetUrl.hostname,
        siteName: targetUrl.hostname,
      };
      return NextResponse.json(fallback, withCacheHeader());
    }

    const boundedHtml = await readBoundedHtml(response, MAX_HTML_BYTES);
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

    return NextResponse.json(payload, withCacheHeader());
  } catch (error) {
    const isAbortError = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      {
        error: isAbortError ? 'Preview request timed out' : 'Failed to generate preview',
      },
      withCacheHeader(504)
    );
  } finally {
    clearTimeout(timeout);
  }
}
