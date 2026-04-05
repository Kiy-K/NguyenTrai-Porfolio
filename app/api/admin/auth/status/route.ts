import { NextResponse } from 'next/server';
import { getActiveAdminSession, getClientIpFromHeaders } from '@/lib/admin-auth';

export async function GET(request: Request) {
  try {
    const ip = getClientIpFromHeaders(request.headers);
    const session = await getActiveAdminSession(ip);

    if (!session) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        expiresAtUnix: session.expiresAtUnix,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
