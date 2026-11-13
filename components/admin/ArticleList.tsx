'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ArticleForm from '@/components/admin/ArticleForm';
import type { MutationState } from '@/components/admin/types';
import type { Product } from '@/data/products';

// Admin list/search (title + section) that opens the shared ArticleForm in edit mode.
export default function ArticleList({ children, ...props }: MutationState & { children?: React.ReactNode }) {
  const [data, setData] = useState<{ products: Product[]; revisions: Record<string, string> } | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/products?fresh=1', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setData(await res.json());
      setError('');
    } catch {
      setError('Không thể tải danh sách bài viết.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.products ?? []).filter(p => !needle || `${p.title} ${p.section ?? ''}`.toLowerCase().includes(needle));
  }, [data, query]);

  const editing = data?.products.find(p => String(p.id) === editingId);
  if (editing) {
    return (
      <ArticleForm key={editingId} {...props} article={editing} revision={data!.revisions[String(editing.id)]}
        onDone={saved => { setEditingId(null); if (saved) load(); }} />
    );
  }

  return (
    <>
    <section className="bg-white rounded-sm shadow-sm border border-[#D4C4A8] p-6 sm:p-8 mb-8" aria-labelledby="article-list-title">
      <h2 id="article-list-title" className="text-2xl font-bold text-[#2C1E16] mb-4 font-playfair">Quản lý bài viết</h2>
      <label htmlFor="article-search" className="sr-only">Tìm theo tiêu đề hoặc chuyên mục</label>
      <input id="article-search" type="search" value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Tìm theo tiêu đề hoặc chuyên mục"
        className="w-full px-4 py-3 mb-4 border-2 border-[#D4C4A8] rounded-lg bg-[#F4EBD0] text-[#2C1E16] focus:ring-2 focus:ring-[#B8860B] outline-none" />
      {error && <p role="alert" className="text-[#8B3A3A] mb-2">{error} <button type="button" onClick={load} className="underline">Thử lại</button></p>}
      {data && !Object.keys(data.revisions).length && data.products.length > 0 && (
        <p className="text-[#5C4033] italic mb-2">Kho dữ liệu hiện tại không hỗ trợ sửa bài viết.</p>
      )}
      <ul className="divide-y divide-[#D4C4A8] max-h-96 overflow-y-auto">
        {shown.map(p => (
          <li key={String(p.id)} className="flex items-center justify-between gap-3 py-3">
            <span className="min-w-0">
              <span className="block truncate text-[#2C1E16] font-bold">{p.title}</span>
              <span className="block text-sm text-[#5C4033]">{p.section ?? '—'}{p.status && p.status !== 'published' ? ` · ${p.status}` : ''}</span>
            </span>
            {data?.revisions[String(p.id)] && (
              <button type="button" onClick={() => setEditingId(String(p.id))} aria-label={`Sửa ${p.title}`}
                className="shrink-0 px-4 py-2 border-2 border-[#B8860B] text-[#8B3A3A] rounded-lg hover:bg-[#F4EBD0]">Sửa</button>
            )}
          </li>
        ))}
        {data && !shown.length && <li className="py-3 text-[#5C4033]">Không có bài viết phù hợp.</li>}
      </ul>
    </section>
    {children}
    </>
  );
}
