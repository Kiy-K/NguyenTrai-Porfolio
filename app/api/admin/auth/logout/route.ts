import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { redis } from '@/lib/redis';
import { enforceSameOrigin } from '@/lib/request-security';

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const cookieStore = await cookies();
    const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

    if (sessionId) {
      await redis.del(`admin:session:${sessionId}`);
    }

    const response = NextResponse.json(
      { success: true },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Error logging out admin:', error);
    return NextResponse.json({ error: 'Không thể đăng xuất' }, { status: 500 });
  }
}
