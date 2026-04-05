import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSession,
  getAdminCredentials,
  getClientIpFromHeaders,
  verifyAdminPassword,
} from '@/lib/admin-auth';
import { consumeRateLimit } from '@/lib/rate-limit';
import { enforceSameOrigin } from '@/lib/request-security';

interface LoginPayload {
  password: string;
}

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return NextResponse.json({ error: 'Chưa cấu hình Redis' }, { status: 500 });
    }

    const ip = getClientIpFromHeaders(request.headers);
    const loginRateLimit = await consumeRateLimit({
      key: `admin:auth:login:${ip}`,
      limit: 10,
      windowSeconds: 15 * 60,
    });
    if (!loginRateLimit.allowed) {
      return NextResponse.json(
        { error: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(loginRateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const { password } = (await request.json()) as LoginPayload;

    if (!password?.trim()) {
      return NextResponse.json({ error: 'Vui lòng nhập mật khẩu.' }, { status: 400 });
    }

    const creds = await getAdminCredentials();
    if (!creds?.passwordHash) {
      return NextResponse.json({ error: 'Admin chưa được khởi tạo mật khẩu.' }, { status: 409 });
    }

    const isValidPassword = await verifyAdminPassword(password.trim());
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Mật khẩu không đúng.' }, { status: 401 });
    }

    const session = await createAdminSession(ip);

    const response = NextResponse.json(
      {
        success: true,
        expiresAt: session.expiresAt,
      },
      { status: 200 }
    );

    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: session.sessionId,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });

    return response;
  } catch (error) {
    console.error('Error logging in admin:', error);
    return NextResponse.json({ error: 'Không thể đăng nhập quản trị' }, { status: 500 });
  }
}
