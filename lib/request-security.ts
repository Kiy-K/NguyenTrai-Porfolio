import { NextResponse } from 'next/server';

export function enforceSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get('origin');
  if (!origin) {
    return NextResponse.json({ error: 'Thiếu header Origin.' }, { status: 403 });
  }

  const expectedOrigin = new URL(request.url).origin;
  if (origin !== expectedOrigin) {
    return NextResponse.json({ error: 'Origin không hợp lệ.' }, { status: 403 });
  }

  return null;
}
