import { NextResponse } from 'next/server';
import { getProduct } from '@/lib/data';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };

// GET /api/products/[id] - Lấy chi tiết một sản phẩm
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const product = await getProduct(resolvedParams.id);
    
    if (!product) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404, headers: noStore });
    }
    
    return NextResponse.json({ product }, { headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi khi tải sản phẩm' }, { status: 500, headers: noStore });
  }
}
