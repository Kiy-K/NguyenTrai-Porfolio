import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/data';
import { redis } from '@/lib/redis';
import { revalidatePath } from 'next/cache';

// GET /api/products - Lấy danh sách tất cả sản phẩm
export async function GET() {
  try {
    const products = await getProducts();
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: 'Không thể tải sản phẩm' }, { status: 500 });
  }
}

// POST /api/products - Thêm sản phẩm mới
export async function POST(request: Request) {
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return NextResponse.json({ error: 'Chưa cấu hình Redis' }, { status: 500 });
    }

    const newProduct = await request.json();
    const data = await redis.get<{ products: any[] }>('portfolio_data_v4') || { products: [] };
    
    // Tạo ID đơn giản nếu chưa có
    if (!newProduct.id) {
      newProduct.id = Date.now().toString();
    }
    
    // Ensure products array exists before pushing
    if (!data.products) {
      data.products = [];
    }
    
    data.products.push(newProduct);
    await redis.set('portfolio_data_v4', data);
    
    // Revalidate paths to ensure fresh data
    revalidatePath('/', 'layout');
    
    return NextResponse.json({ success: true, product: newProduct }, { status: 201 });
  } catch (error) {
    console.error('Error adding product:', error);
    return NextResponse.json({ error: 'Không thể thêm sản phẩm' }, { status: 500 });
  }
}
