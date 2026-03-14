import { redis } from './redis';
import { products as mockProducts, Product } from '@/data/products';
import { unstable_cache } from 'next/cache';

// Hàm lấy danh sách sản phẩm từ Redis (hoặc dữ liệu mẫu nếu chưa cấu hình)
export const getProducts = unstable_cache(
  async (): Promise<Product[]> => {
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return mockProducts;
    }
    try {
      const data = await redis.get<{ products: Product[] }>('portfolio_data_v4');
      if (!data || !data.products || data.products.length === 0) {
        // Khởi tạo dữ liệu mẫu vào Redis nếu chưa có
        await redis.set('portfolio_data_v4', { products: mockProducts });
        return mockProducts;
      }
      return data.products;
    } catch (e) {
      console.error('Lỗi Redis:', e);
      return mockProducts;
    }
  },
  ['products-cache'],
  { revalidate: 900, tags: ['products'] }
);

// Hàm lấy chi tiết một sản phẩm
export async function getProduct(id: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find(p => p.id.toString() === id.toString());
}
