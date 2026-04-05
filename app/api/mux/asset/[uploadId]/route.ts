import { NextResponse } from 'next/server';
import Mux from '@mux/mux-node';
import { getActiveAdminSession, getClientIpFromHeaders } from '@/lib/admin-auth';
import { consumeRateLimit } from '@/lib/rate-limit';

// GET /api/mux/asset/[uploadId]
// Polls the Mux upload → asset pipeline and returns a unified status.
// Statuses returned: 'uploading' | 'processing' | 'ready' | 'error'
export async function GET(
  request: Request,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    return NextResponse.json({ error: 'Chưa cấu hình Mux API' }, { status: 500 });
  }

  const ip = getClientIpFromHeaders(request.headers);
  const session = await getActiveAdminSession(ip);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimit = await consumeRateLimit({
    key: `admin:mux:asset:${ip}`,
    limit: 300,
    windowSeconds: 10 * 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Bạn truy vấn quá nhanh. Vui lòng thử lại sau.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  const { uploadId } = await params;

  try {
    const mux = new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET,
    });

    const upload = await mux.video.uploads.retrieve(uploadId);

    if (upload.status === 'waiting') {
      return NextResponse.json({ status: 'uploading' });
    }

    if (upload.status === 'errored' || upload.status === 'timed_out') {
      return NextResponse.json({ status: 'error' });
    }

    // Upload file was received — now check the resulting asset
    if (upload.asset_id) {
      const asset = await mux.video.assets.retrieve(upload.asset_id);

      if (asset.status === 'errored') {
        return NextResponse.json({ status: 'error' });
      }

      if (asset.status === 'ready' && asset.playback_ids?.length) {
        return NextResponse.json({
          status: 'ready',
          assetId: asset.id,
          playbackId: asset.playback_ids[0].id,
        });
      }

      return NextResponse.json({ status: 'processing', assetId: asset.id });
    }

    return NextResponse.json({ status: 'processing' });
  } catch (error) {
    console.error('Mux asset status check failed:', error);
    return NextResponse.json({ error: 'Không thể kiểm tra trạng thái' }, { status: 500 });
  }
}
