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

export function enforceDataWriteAvailability(): NextResponse | null {
  if (process.env.DATA_WRITE_PAUSED !== '1') return null;
  return NextResponse.json(
    { error: 'Hệ thống đang chuyển dữ liệu. Vui lòng thử lại sau ít phút.' },
    { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store', 'X-Data-Write-Paused': '1' } }
  );
}
