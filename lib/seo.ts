import type { Metadata, MetadataRoute } from 'next';
import type { Product } from '@/data/products';
import { SECTIONS } from '@/lib/constants';
import { z } from 'zod';

export const PRODUCTION_ORIGIN = 'https://nguyen-trai-porfolio.vercel.app';
export const SITE_TITLE = 'Nguyễn Trãi - Danh nhân văn hóa thế giới';
export const SITE_DESCRIPTION = 'Tìm hiểu về cuộc đời và sự nghiệp của Nguyễn Trãi';
export const canonicalUrl = (path: string) => `${PRODUCTION_ORIGIN}${path}`;

function plainText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : '';
}

function isHttpImage(value: unknown): value is string {
  if (typeof value !== 'string' || !value.isWellFormed() || value !== value.trim() || value.includes('\\')) return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

// Validate fields consumed by the public renderer without rewriting legacy payloads.
const renderableArticle = z.object({
  title: z.string().trim().min(1),
  description: z.string().nullish(), fullDescription: z.string().nullish(), section: z.string().nullish(),
  images: z.array(z.string().refine(image =>
    (image.startsWith('/') && !image.startsWith('//') && !image.includes('\\') && image.isWellFormed()) || isHttpImage(image))).nullish(), tags: z.array(z.string()).nullish(),
  video: z.string().nullish(), muxAssetId: z.string().nullish(), muxPlaybackId: z.string().nullish(),
  videos: z.array(z.object({ video: z.string().nullish(), muxAssetId: z.string().nullish(), muxPlaybackId: z.string().nullish() })).nullish(),
  references: z.array(z.object({ title: z.string(), url: z.string().nullish(), author: z.string().nullish(), publisher: z.string().nullish() })).nullish(),
});

export function isDiscoverableArticle(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false;
  const product = value as Product;
  const id = product.id;
  return (product.status === undefined || product.status === 'published')
    && ((typeof id === 'number' && Number.isFinite(id))
      || (typeof id === 'string' && !!id.trim() && id === id.trim() && id.isWellFormed() && !['.', '..'].includes(id)))
    && renderableArticle.safeParse(product).success;
}

export const articlePath = (product: Product) => `/products/${encodeURIComponent(String(product.id))}`;

function articleImages(product: Product): string[] {
  if (!Array.isArray(product.images)) return [];
  return product.images.filter(isHttpImage);
}

export function pageMetadata(title: string, description: string, path: string, product?: Product): Metadata {
  const url = canonicalUrl(path);
  const images = product ? articleImages(product) : [];
  return {
    title, description: description || undefined,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: product ? 'article' : 'website', title, description: description || undefined,
      url, siteName: SITE_TITLE, locale: 'vi_VN', images,
    },
    twitter: { card: images.length ? 'summary_large_image' : 'summary', title, description: description || undefined, images },
  };
}

export const homeMetadata = () => pageMetadata(SITE_TITLE, SITE_DESCRIPTION, '/');
export function sectionMetadata(section: typeof SECTIONS[number]): Metadata {
  return pageMetadata(`${section.name} | Nguyễn Trãi`, `Các bài viết trong chuyên mục ${section.name} về Nguyễn Trãi.`, section.path);
}
export function articleMetadata(product: Product): Metadata {
  return pageMetadata(`${plainText(product.title)} | Nguyễn Trãi`,
    plainText(product.description) || plainText(product.fullDescription), articlePath(product), product);
}

export function buildSitemap(products: unknown[]): MetadataRoute.Sitemap {
  const urls: MetadataRoute.Sitemap = [
    { url: canonicalUrl('/') }, ...SECTIONS.map(section => ({ url: canonicalUrl(section.path) })),
  ];
  const seen = new Set(urls.map(entry => entry.url));
  for (const product of products.filter(isDiscoverableArticle)) {
    const url = canonicalUrl(articlePath(product));
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push({ url });
  }
  return urls;
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Trang chủ', path: '/' }, ...items].map((item, index) => ({
      '@type': 'ListItem', position: index + 1, name: item.name, item: canonicalUrl(item.path),
    })),
  };
}
export function articleStructuredData(product: Product) {
  const section = SECTIONS.find(section => typeof product.section === 'string' && section.name.toLowerCase() === product.section.toLowerCase());
  const path = articlePath(product);
  const description = plainText(product.description) || plainText(product.fullDescription);
  return [
    {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: plainText(product.title), url: canonicalUrl(path), inLanguage: 'vi',
      mainEntityOfPage: canonicalUrl(path),
      ...(description ? { description } : {}),
      ...(articleImages(product).length ? { image: articleImages(product) } : {}),
      ...(section ? { articleSection: section.name } : {}),
    },
    breadcrumbs([...(section ? [{ name: section.name, path: section.path }] : []), { name: plainText(product.title), path }]),
  ];
}
export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
