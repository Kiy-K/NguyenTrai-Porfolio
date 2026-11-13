import { NextResponse } from 'next/server';
import { getProduct } from '@/lib/data';
import { updateProduct } from '@/lib/persistence';
import { getActiveAdminSession, getClientIpFromHeaders } from '@/lib/admin-auth';
import { enforceSameOrigin, enforceDataWriteAvailability } from '@/lib/request-security';
import { consumeRateLimit } from '@/lib/rate-limit';
import { productPatchSchema, readProductInput } from '@/lib/product-input';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };

// GET /api/products/[id] - Lấy chi tiết một sản phẩm
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const product = await getProduct(resolvedParams.id);
    
    if (!product) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404, headers: noStore });
    }
    
    return NextResponse.json({ product }, { headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi khi tải sản phẩm' }, { status: 500, headers: noStore });
  }
}

// PATCH /api/products/[id] - Admin sửa bài viết; chỉ ghi các trường được gửi, kiểm tra revision (409 nếu cũ)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;
    const writePause = enforceDataWriteAvailability();
    if (writePause) return writePause;
    const ip = getClientIpFromHeaders(request.headers);
    if (!await getActiveAdminSession(ip)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
    const rateLimit = await consumeRateLimit({ key: `admin:products:update:${ip}`, limit: 120, windowSeconds: 15 * 60 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' },
        { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }
    const parsed = productPatchSchema.safeParse(await readProductInput(request));
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path.join('.') || 'body';
      return NextResponse.json({ error: `Dữ liệu sản phẩm không hợp lệ (${field})` }, { status: 400, headers: noStore });
    }
    const set: Record<string, unknown> = {};
    const remove: string[] = [];
    for (const [key, value] of Object.entries(parsed.data.changes)) {
      if (value === null) remove.push(key);
      else if (value !== undefined) set[key] = value;
    }
    const result = await updateProduct((await params).id, parsed.data.revision, set, remove);
    if (result === 'not_found') return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404, headers: noStore });
    if (result === 'conflict') return NextResponse.json({ error: 'Bài viết đã được thay đổi. Hãy tải lại trước khi lưu.' }, { status: 409, headers: noStore });
    if (result === 'duplicate' || result === 'unsupported') {
      return NextResponse.json({ error: 'Không thể sửa bài viết trên kho dữ liệu hiện tại' }, { status: 503, headers: noStore });
    }
    return NextResponse.json({ success: true }, { headers: noStore });
  } catch (error) {
    console.error('Error updating product:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Không thể cập nhật sản phẩm' }, { status: 500, headers: noStore });
  }
}
