import Link from 'next/link';

export default function BreadcrumbNav({ items }: { items: { name: string; path: string }[] }) {
  const trail = [{ name: 'Trang chủ', path: '/' }, ...items];
  return (
    <nav aria-label="Đường dẫn trang" className="mb-6 min-w-0 text-sm text-[#5C4033]">
      <ol className="flex min-w-0 items-center gap-2">
        {trail.map((item, index) => (
          <li key={item.path} className="flex min-w-0 items-center gap-2">
            {index > 0 && <span aria-hidden="true">›</span>}
            {index === trail.length - 1 ? (
              <span aria-current="page" className="truncate font-semibold text-[#2C1E16]">{item.name}</span>
            ) : (
              <Link href={item.path} prefetch={false} className="truncate rounded-sm py-2 text-[#8B3A3A] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B3A3A]">{item.name}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
