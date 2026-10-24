import type { Product } from '@/data/products';
import { articleSection, isDiscoverableArticle } from '@/lib/seo';

const normalizeTag = (tag: string) => tag.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g, 'd').trim().replace(/\s+/g, ' ');
const tagsOf = (product: Product) => new Set((product.tags ?? []).map(normalizeTag).filter(Boolean));
const titles = new Intl.Collator('vi');
const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function relatedArticles(current: Product, products: unknown[]): Product[] {
  if (!isDiscoverableArticle(current)) return [];
  const section = articleSection(current);
  const tags = tagsOf(current);
  // Duplicate routes resolve to the first stored record, just like getProduct.
  const seen = new Set([String(current.id)]);
  const ranked = [];
  for (const value of products) {
    if (!value || typeof value !== 'object' || !('id' in value)) continue;
    if (typeof value.id !== 'string' && typeof value.id !== 'number') continue;
    const id = String(value.id);
    if (seen.has(id)) continue;
    seen.add(id);
    if (!isDiscoverableArticle(value)) continue;
    const sameSection = !!section && articleSection(value)?.id === section.id;
    const sharedTags = [...tagsOf(value)].filter(tag => tags.has(tag)).length;
    if (sameSection || sharedTags) ranked.push({ product: value, sameSection, sharedTags });
  }
  return ranked.sort((a, b) => Number(b.sameSection) - Number(a.sameSection)
    || b.sharedTags - a.sharedTags || titles.compare(a.product.title, b.product.title)
    || compareId(String(a.product.id), String(b.product.id)))
    .slice(0, 3).map(item => item.product);
}
