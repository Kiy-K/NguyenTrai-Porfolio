import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ADMIN_SESSION_COOKIE = 'admin_session';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    const hasSessionCookie = Boolean(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

    if (!hasSessionCookie) {
      const loginUrl = new URL('/admin/login', request.url);
      if (pathname !== '/admin/login') {
        loginUrl.searchParams.set('next', `${pathname}${search}`);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
