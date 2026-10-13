import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/data';
import { appendProduct, readContent, writeContent } from '@/lib/persistence';
import { CLEAR_ALL_CONFIRMATION } from '@/lib/constants';
import { revalidatePath } from 'next/cache';
import { getActiveAdminSession, getClientIpFromHeaders } from '@/lib/admin-auth';
import { enforceSameOrigin, enforceDataWriteAvailability } from '@/lib/request-security';
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

    const writePause = enforceDataWriteAvailability();
    if (writePause) return writePause;

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

    const body = await request.json().catch(() => null);
    if (body?.confirm !== CLEAR_ALL_CONFIRMATION) {
      return NextResponse.json(
        { error: `Cần nhập "${CLEAR_ALL_CONFIRMATION}" để xác nhận xóa toàn bộ dữ liệu.` },
        { status: 400 }
      );
    }

    // Read uncached so the recovery copy matches what is actually cleared.
    // shortcut: a product added between this read and the write is cleared without being returned; fine for a single admin, use an atomic UPDATE … RETURNING if that changes.
    const removed = (await readContent())?.products ?? [];

    // Reset the portfolio_data_v4 key to an empty array
    await writeContent({ products: [] });

    // Revalidate paths to ensure fresh data
    revalidatePath('/', 'layout');

    return NextResponse.json(
      { success: true, message: 'Đã xóa toàn bộ dữ liệu', deleted: removed },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error clearing database:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Không thể xóa dữ liệu' }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const writePause = enforceDataWriteAvailability();
    if (writePause) return writePause;

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
    
    // Tạo ID đơn giản nếu chưa có
    if (!newProduct.id) {
      newProduct.id = Date.now().toString();
    }
    
    await appendProduct(newProduct);
    
    // Revalidate paths to ensure fresh data
    revalidatePath('/', 'layout');
    
    return NextResponse.json({ success: true, product: newProduct }, { status: 201 });
  } catch (error) {
    console.error('Error adding product:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Không thể thêm sản phẩm' }, { status: 500 });
  }
}
