import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/data';
import { redis } from '@/lib/redis';
import { revalidatePath } from 'next/cache';
import { getActiveAdminSession, getClientIpFromHeaders } from '@/lib/admin-auth';
import { enforceSameOrigin } from '@/lib/request-security';
import { consumeRateLimit } from '@/lib/rate-limit';

// GET /api/products - Lấy danh sách tất cả sản phẩm
export async function GET() {
  try {
    const products = await getProducts();
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: 'Không thể tải sản phẩm' }, { status: 500 });
  }
}

// DELETE /api/products - Xóa toàn bộ sản phẩm (Clear database)
export async function DELETE(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return NextResponse.json({ error: 'Chưa cấu hình Redis' }, { status: 500 });
    }

    const ip = getClientIpFromHeaders(request.headers);
    const session = await getActiveAdminSession(ip);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit({
      key: `admin:products:delete:${ip}`,
      limit: 20,
      windowSeconds: 15 * 60,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    // Reset the portfolio_data_v4 key to an empty array
    await redis.set('portfolio_data_v4', { products: [] });
    
    // Revalidate paths to ensure fresh data
    revalidatePath('/', 'layout');
    
    return NextResponse.json({ success: true, message: 'Đã xóa toàn bộ dữ liệu' }, { status: 200 });
  } catch (error) {
    console.error('Error clearing database:', error);
    return NextResponse.json({ error: 'Không thể xóa dữ liệu' }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return NextResponse.json({ error: 'Chưa cấu hình Redis' }, { status: 500 });
    }

    const ip = getClientIpFromHeaders(request.headers);
    const session = await getActiveAdminSession(ip);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit({
      key: `admin:products:create:${ip}`,
      limit: 120,
      windowSeconds: 15 * 60,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
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
