import Link from 'next/link';
import type { Product } from '@/data/products';
import { articlePath } from '@/lib/seo';

export default function RelatedArticles({ products }: { products: Product[] }) {
  if (!products.length) return null;
  return (
    <section aria-labelledby="related-articles-title" className="mt-12 border-t border-[#D4C4A8] pt-8">
      <h2 id="related-articles-title" className="mb-6 text-2xl font-bold text-[#2C1E16]">Bài viết liên quan</h2>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {products.map(product => (
          <li key={articlePath(product)} className="min-w-0">
            <Link href={articlePath(product)} prefetch={false} className="block h-full rounded-sm border border-[#D4C4A8] bg-[#F4EBD0] p-4 text-[#8B3A3A] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B3A3A]">
              <h3 className="break-words text-lg font-bold">{product.title}</h3>
              {product.description && <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-[#5C4033]">{product.description}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
