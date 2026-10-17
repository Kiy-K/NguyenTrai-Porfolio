import { readContent, usesPostgres } from '@/lib/persistence';
import type { Product } from '@/data/products';
import { publicProducts, readPublicProducts } from '@/lib/product-cache';

export async function getProducts(): Promise<Product[]> {
  const load = async () => (await readContent())?.products ?? [];
  if (usesPostgres()) return readPublicProducts(load);
  // Explicit operator-selected rollback backend; never a fallback for a Neon failure.
  if (!process.env.UPSTASH_REDIS_REST_URL) return [];
  return publicProducts(await load());
}
export async function getProduct(id: string): Promise<Product | undefined> {
  return (await getProducts()).find(product => String(product.id) === String(id));
}
