import MiniSearch from 'minisearch';
import type { Product } from '@/data/products';

export type ProductSort = 'relevance' | 'title-asc' | 'title-desc';

export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g, 'd');
}

export function createProductSearch(receivedProducts: Product[]) {
  // Match the public read contract, including legacy records without a status.
  const products = receivedProducts.filter(p => p.status === undefined || p.status === 'published');
  const index = new MiniSearch({
    fields: ['title', 'tags', 'description', 'section'],
    processTerm: normalizeSearchText,
    searchOptions: {
      boost: { title: 6, tags: 3, section: 2, description: 1 },
      combineWith: 'AND',
      prefix: term => term.length >= 2,
      fuzzy: term => term.length >= 4 ? 1 : false,
    },
  });
  index.addAll(products.map(p => ({
    id: p.id, title: p.title, tags: p.tags?.join(' ') || '',
    description: p.description, section: p.section || '',
  })));
  return { products, index };
}

export function findProducts(
  { products, index }: ReturnType<typeof createProductSearch>,
  query: string,
  sort: ProductSort = 'relevance',
  tags: string[] = [],
): Product[] {
  const hasQuery = query.trim().length > 0;
  const scores = new Map(index.search(query).map(result => [result.id, result.score]));
  return products.filter(p => (!hasQuery || scores.has(p.id)) && tags.every(tag => p.tags?.includes(tag)))
    .sort((a, b) => {
      if (hasQuery && sort === 'relevance') {
        const scoreDifference = (scores.get(b.id) || 0) - (scores.get(a.id) || 0);
        if (scoreDifference) return scoreDifference;
      }
      const titleDifference = a.title.localeCompare(b.title, 'vi');
      return (sort === 'title-desc' ? -titleDifference : titleDifference)
        || String(a.id).localeCompare(String(b.id), 'vi', { numeric: true });
    });
}
