import { NextResponse } from 'next/server';
import Mux from '@mux/mux-node';
import { getActiveAdminSession, getClientIpFromHeaders } from '@/lib/admin-auth';
import { consumeRateLimit } from '@/lib/rate-limit';
import { enforceSameOrigin } from '@/lib/request-security';

// POST /api/mux/upload-url
// Creates a Mux direct upload session and returns the one-time upload URL.
// Credentials never leave the server.
export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    return NextResponse.json({ error: 'Chưa cấu hình Mux API' }, { status: 500 });
  }

  try {
    const ip = getClientIpFromHeaders(request.headers);
    const session = await getActiveAdminSession(ip);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit({
      key: `admin:mux:upload-url:${ip}`,
      limit: 60,
      windowSeconds: 10 * 60,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const mux = new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET,
    });

    const requestOrigin = new URL(request.url).origin;
    const corsOrigin = process.env.APP_URL || requestOrigin;
    const upload = await mux.video.uploads.create({
      cors_origin: corsOrigin,
      new_asset_settings: {
        playback_policy: ['public'],
      },
    });

    return NextResponse.json({ uploadUrl: upload.url, uploadId: upload.id });
  } catch (error) {
    console.error('Mux upload URL creation failed:', error);
    return NextResponse.json({ error: 'Không thể tạo upload URL' }, { status: 500 });
  }
}
