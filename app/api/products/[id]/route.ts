import { NextResponse } from 'next/server';
import { getProduct } from '@/lib/data';

// GET /api/products/[id] - Lấy chi tiết một sản phẩm
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const product = await getProduct(resolvedParams.id);
    
    if (!product) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }
    
    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi khi tải sản phẩm' }, { status: 500 });
  }
}
