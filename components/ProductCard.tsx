import Image from 'next/image';
import Link from 'next/link';
import { Product } from '@/data/products';
import { ChevronRight } from 'lucide-react';
import SummarizeButton from '@/components/SummarizeButton';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200 flex flex-col">
      <Link href={`/products/${product.id}`} className="group block">
        {/* Product Image */}
        <div className="relative h-48 w-full overflow-hidden bg-gray-100">
          <Image
            src={product.images[0]}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
          />
        </div>
      </Link>
      
      {/* Product Details */}
      <div className="p-5 flex flex-col flex-grow">
        <Link href={`/products/${product.id}`} className="group block mb-2">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
            {product.title}
          </h3>
        </Link>
        <p className="text-sm text-gray-600 line-clamp-2">
          {product.description}
        </p>
        
        {/* AI Summarization Feature (Compact mode for cards) */}
        <SummarizeButton text={product.description} compact={true} />
        
        <div className="mt-auto pt-4 border-t border-gray-50 flex items-center text-sm font-medium text-indigo-600">
          <Link href={`/products/${product.id}`} className="inline-flex items-center hover:text-indigo-800 transition-colors">
            Xem chi tiết
            <ChevronRight className="ml-1 w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
