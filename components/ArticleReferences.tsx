import type { ArticleReference } from '@/data/products';
import { isReferenceUrl } from '@/lib/article-references';

export default function ArticleReferences({ references }: { references?: ArticleReference[] }) {
  if (!references?.length) return null;

  return (
    <section aria-labelledby="article-references-heading" className="border-t border-[#D4C4A8] pt-6 text-[#2C1E16]">
      <h2 id="article-references-heading" className="text-2xl font-bold mb-4">Nguồn tham khảo</h2>
      <ol className="list-decimal pl-6 space-y-3 break-words">
        {references.map((reference, index) => (
          <li key={index}>
            {reference.url && isReferenceUrl(reference.url) ? (
              <a href={reference.url} target="_blank" rel="noopener noreferrer" className="text-[#8B3A3A] underline underline-offset-4 hover:text-[#2C1E16]">
                {reference.title}
              </a>
            ) : <span>{reference.title}</span>}
            {reference.author && <p className="text-sm text-[#5C4033]">{reference.author}</p>}
            {reference.publisher && <p className="text-sm text-[#5C4033]">{reference.publisher}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
