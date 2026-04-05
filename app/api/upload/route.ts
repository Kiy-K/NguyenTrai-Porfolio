import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { getActiveAdminSession, getClientIpFromHeaders } from '@/lib/admin-auth';
import { consumeRateLimit } from '@/lib/rate-limit';
import { enforceSameOrigin } from '@/lib/request-security';

// Cloudinary automatically uses the CLOUDINARY_URL environment variable if set.
// Format: CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const ip = getClientIpFromHeaders(request.headers);
    const session = await getActiveAdminSession(ip);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit({
      key: `admin:upload:${ip}`,
      limit: 120,
      windowSeconds: 10 * 60,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Bạn tải lên quá nhanh. Vui lòng thử lại sau.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const requestedResourceType = (formData.get('resourceType') as string) || 'auto';
    const resourceType = ['image', 'video', 'auto'].includes(requestedResourceType)
      ? requestedResourceType
      : 'auto';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const maxFileSize = 20 * 1024 * 1024;
    if (file.size > maxFileSize) {
      return NextResponse.json({ error: 'File quá lớn (tối đa 20MB).' }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: resourceType as 'image' | 'video' | 'auto', folder: 'portfolio_uploads' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('Cloudinary upload error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
