import { NextResponse } from 'next/server';
import Mux from '@mux/mux-node';

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

// POST /api/mux/upload-url
// Creates a Mux direct upload session and returns the one-time upload URL.
// Credentials never leave the server.
export async function POST() {
  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    return NextResponse.json({ error: 'Chưa cấu hình Mux API' }, { status: 500 });
  }

  try {
    const upload = await mux.video.uploads.create({
      cors_origin: process.env.APP_URL || '*',
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
