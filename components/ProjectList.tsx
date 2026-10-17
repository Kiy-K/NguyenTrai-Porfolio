'use client';

import { useState, useMemo } from 'react';
import ProjectCard from '@/components/ProjectCard';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '@/data/products';
import { createProductSearch, findProducts, type ProductSort } from '@/lib/product-search';

interface ProjectListProps {
  products: Product[];
}

const ITEMS_PER_PAGE = 10;

export default function ProjectList({ products }: ProjectListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<ProductSort>('relevance');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const search = useMemo(() => createProductSearch(products), [products]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOption(e.target.value as ProductSort);
    setCurrentPage(1);
  };

  // Lấy danh sách tất cả các tags duy nhất từ products
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    search.products.forEach(product => {
      if (product.tags) {
        product.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }, [search]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
    setCurrentPage(1);
  };

  const filteredProducts = useMemo(
    () => findProducts(search, searchQuery, sortOption, selectedTags),
    [search, searchQuery, sortOption, selectedTags],
  );
  const pageCount = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const visiblePage = Math.min(currentPage, Math.max(1, pageCount));

  return (
    <div>
      {/* Search Bar and Sort */}
      <div className="mb-6 max-w-5xl mx-auto flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-[#8B3A3A]" aria-hidden="true" />
          </div>
          <input
            type="search"
            aria-label="Tìm kiếm tác phẩm"
            className="block w-full pl-12 pr-4 py-3 border border-[#D4C4A8] rounded-sm leading-5 bg-white placeholder-[#8B3A3A]/60 focus:outline-none focus:ring-1 focus:ring-[#B8860B] focus:border-[#B8860B] transition-all shadow-sm font-playfair text-[#2C1E16]"
            placeholder="Tìm theo tên, thẻ hoặc nội dung..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative min-w-[180px]">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <ArrowUpDown className="h-5 w-5 text-[#8B3A3A]" />
            </div>
            <select
              aria-label="Sắp xếp tác phẩm"
              value={sortOption}
              onChange={handleSortChange}
              className="block w-full pl-12 pr-10 py-3 border border-[#D4C4A8] rounded-sm leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-[#B8860B] focus:border-[#B8860B] transition-all shadow-sm font-playfair text-[#2C1E16] appearance-none cursor-pointer"
            >
              <option value="relevance">Liên quan nhất</option>
              <option value="title-asc">Tên (A-Z)</option>
              <option value="title-desc">Tên (Z-A)</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-[#8B3A3A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <div className="mb-12 max-w-5xl mx-auto">
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                aria-pressed={selectedTags.includes(tag)}
                className={`px-4 py-1.5 text-sm font-playfair rounded-full border transition-all duration-300 ${
                  selectedTags.includes(tag)
                    ? 'bg-[#8B3A3A] text-white border-[#8B3A3A] shadow-sm'
                    : 'bg-white text-[#5C4033] border-[#D4C4A8] hover:border-[#B8860B] hover:text-[#8B3A3A]'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">{filteredProducts.length} tác phẩm phù hợp. Trang {visiblePage}.</p>

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.slice((visiblePage - 1) * ITEMS_PER_PAGE, visiblePage * ITEMS_PER_PAGE).map((product) => (
              <div 
                key={product.id} 
                className="motion-safe:animate-in motion-safe:fade-in duration-300"
              >
                <ProjectCard 
                  id={product.id}
                  title={product.title}
                  description={product.description}
                  imageUrl={product.images && product.images.length > 0 ? product.images[0] : undefined}
                  linkHref={`/products/${product.id}`}
                  tags={product.tags}
                />
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {filteredProducts.length > ITEMS_PER_PAGE && (
            <div className="mt-16 flex justify-center items-center gap-4">
              <button
                onClick={() => setCurrentPage(Math.max(visiblePage - 1, 1))}
                disabled={visiblePage === 1}
                className="p-2 rounded-full border border-[#D4C4A8] text-[#8B3A3A] hover:bg-[#F4EBD0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Trang trước"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <div className="flex items-center gap-2">
                {Array.from({ length: pageCount }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    aria-label={`Trang ${i + 1}`}
                    aria-current={visiblePage === i + 1 ? 'page' : undefined}
                    className={`w-10 h-10 rounded-full font-playfair font-bold transition-all duration-300 ${
                      visiblePage === i + 1
                        ? 'bg-[#8B3A3A] text-white shadow-md scale-110'
                        : 'text-[#5C4033] hover:bg-[#F4EBD0] hover:text-[#8B3A3A]'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(visiblePage + 1, pageCount))}
                disabled={visiblePage === pageCount}
                className="p-2 rounded-full border border-[#D4C4A8] text-[#8B3A3A] hover:bg-[#F4EBD0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Trang sau"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 bg-white rounded-sm border border-[#D4C4A8] shadow-sm">
          <p className="text-[#5C4033] text-xl font-playfair italic">Không tìm thấy tác phẩm nào phù hợp.</p>
          <button 
            onClick={() => {
              setSearchQuery('');
              setSortOption('relevance');
              setCurrentPage(1);
              setSelectedTags([]);
            }}
            className="mt-6 text-[#8B3A3A] font-bold hover:text-[#B8860B] font-playfair text-lg underline decoration-2 underline-offset-4"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}
    </div>
  );
}
