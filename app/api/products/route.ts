import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/data';
import { appendProduct, writeContent } from '@/lib/persistence';
import { revalidatePath } from 'next/cache';
import { getActiveAdminSession, getClientIpFromHeaders } from '@/lib/admin-auth';
import { enforceSameOrigin, enforceDataWriteAvailability } from '@/lib/request-security';
import { consumeRateLimit } from '@/lib/rate-limit';
import { SECTIONS } from '@/lib/constants';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const isHttpUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
const httpUrl = z.string().trim().max(2048).refine(isHttpUrl);
const muxId = z.string().trim().regex(/^[A-Za-z0-9]{1,128}$/);

// Mirrors the admin form; unknown keys (id, status, ...) are stripped.
const productInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  fullDescription: z.string().max(50_000).optional(),
  images: z.array(httpUrl).max(50).default([]),
  video: httpUrl.optional(),
  muxAssetId: muxId.optional(),
  muxPlaybackId: muxId.optional(),
  videos: z
    .array(z.object({ video: httpUrl.optional(), muxAssetId: muxId.optional(), muxPlaybackId: muxId.optional() }))
    .max(20)
    .optional(),
  teamMembers: z.string().trim().max(1000).optional(),
  section: z.string().refine((name) => SECTIONS.some((section) => section.name === name)),
});

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

    // Reset the portfolio_data_v4 key to an empty array
    await writeContent({ products: [] });
    
    // Revalidate paths to ensure fresh data
    revalidatePath('/', 'layout');
    
    return NextResponse.json({ success: true, message: 'Đã xóa toàn bộ dữ liệu' }, { status: 200 });
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

    const parsed = productInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dữ liệu sản phẩm không hợp lệ' }, { status: 400 });
    }
    const newProduct = { ...parsed.data, id: randomUUID() };

    await appendProduct(newProduct);
    
    // Revalidate paths to ensure fresh data
    revalidatePath('/', 'layout');
    
    return NextResponse.json({ success: true, product: newProduct }, { status: 201 });
  } catch (error) {
    console.error('Error adding product:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Không thể thêm sản phẩm' }, { status: 500 });
  }
}
