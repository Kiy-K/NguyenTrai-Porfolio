import { NextResponse } from 'next/server';
import { bootstrapAdminCredentials, getClientIpFromHeaders } from '@/lib/admin-auth';
import { consumeRateLimit } from '@/lib/rate-limit';
import { enforceSameOrigin } from '@/lib/request-security';

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return NextResponse.json({ error: 'Chưa cấu hình Redis' }, { status: 500 });
    }

    const ip = getClientIpFromHeaders(request.headers);
    const bootstrapRateLimit = await consumeRateLimit({
      key: `admin:auth:bootstrap:${ip}`,
      limit: 5,
      windowSeconds: 60 * 60,
    });
    if (!bootstrapRateLimit.allowed) {
      return NextResponse.json(
        { error: 'Bạn đã thử khởi tạo quá nhiều lần. Vui lòng thử lại sau.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(bootstrapRateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const result = await bootstrapAdminCredentials();
    if (!result.created || !result.password) {
      return NextResponse.json(
        {
          error: 'Mật khẩu admin đã được khởi tạo trước đó. Vì lý do bảo mật, không thể đọc lại.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        password: result.password,
        wasCreated: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error bootstrapping admin credentials:', error);
    return NextResponse.json({ error: 'Không thể khởi tạo mật khẩu admin' }, { status: 500 });
  }
}
