import { readContent, usesPostgres } from '@/lib/persistence';
import { Product } from '@/data/products';
import { unstable_cache } from 'next/cache';

// Hàm lấy danh sách sản phẩm từ Redis
export const getProducts = unstable_cache(
  async (): Promise<Product[]> => {
    if (!usesPostgres() && !process.env.UPSTASH_REDIS_REST_URL) {
      console.warn('UPSTASH_REDIS_REST_URL is not set. Returning empty array.');
      return [];
    }
    try {
      const data = await readContent();
      if (!data || !data.products) {
        return [];
      }
      return data.products;
    } catch (e) {
      console.error('Content read failed:', e instanceof Error ? e.name : 'UnknownError');
      if (usesPostgres()) throw e;
      return [];
    }
  },
  ['products-cache'],
  { revalidate: 1800, tags: ['products'] }
);

// Hàm lấy chi tiết một sản phẩm
export async function getProduct(id: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find(p => p.id.toString() === id.toString());
}
