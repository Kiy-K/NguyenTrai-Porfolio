import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Cloudinary automatically uses the CLOUDINARY_URL environment variable if set.
// Format: CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const resourceType = formData.get('resourceType') as string || 'auto';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: resourceType as any, folder: 'portfolio_uploads' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
