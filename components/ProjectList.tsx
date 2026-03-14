'use client';

import { useState, useMemo, useEffect } from 'react';
import ProjectCard from '@/components/ProjectCard';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Product } from '@/data/products';

interface ProjectListProps {
  products: Product[];
}

type SortOption = 'title-asc' | 'title-desc';
const ITEMS_PER_PAGE = 10;

const normalizeText = (str: string) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
};

export default function ProjectList({ products }: ProjectListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('title-asc');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [aiMatchedIds, setAiMatchedIds] = useState<string[] | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);

  useEffect(() => {
    const fetchAiMatches = async () => {
      if (searchQuery.trim().length < 2) {
        setAiMatchedIds(null);
        setIsAiSearching(false);
        return;
      }

      setIsAiSearching(true);
      try {
        const res = await fetch('/api/search-projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: searchQuery, 
            projects: products.map(p => ({ id: p.id, title: p.title, description: p.description })) 
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.matchedIds) {
            setAiMatchedIds(data.matchedIds);
          }
        }
      } catch (error) {
        console.error('AI Search failed:', error);
      } finally {
        setIsAiSearching(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchAiMatches();
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, products]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setAiMatchedIds(null);
    setCurrentPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOption(e.target.value as SortOption);
    setCurrentPage(1);
  };

  // Lấy danh sách tất cả các tags duy nhất từ products
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    products.forEach(product => {
      if (product.tags) {
        product.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }, [products]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
    setCurrentPage(1);
  };

  const filteredProducts = products
    .filter((product) => {
      const query = normalizeText(searchQuery);
      const matchesTextSearch = 
        normalizeText(product.title).includes(query) ||
        normalizeText(product.description).includes(query) ||
        (product.tags && product.tags.some(tag => normalizeText(tag).includes(query)));
      
      const matchesAiSearch = aiMatchedIds ? aiMatchedIds.includes(String(product.id)) : false;
      
      const matchesSearch = query.length === 0 || matchesTextSearch || matchesAiSearch;
      
      const matchesTags = selectedTags.length === 0 || 
        (product.tags && selectedTags.every(tag => product.tags!.includes(tag)));

      return matchesSearch && matchesTags;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

  return (
    <div>
      {/* Search Bar and Sort */}
      <div className="mb-6 max-w-5xl mx-auto flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            {isAiSearching ? (
              <Sparkles className="h-5 w-5 text-[#B8860B] animate-pulse" />
            ) : (
              <Search className="h-5 w-5 text-[#8B3A3A]" />
            )}
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-3 border border-[#D4C4A8] rounded-sm leading-5 bg-white placeholder-[#8B3A3A]/60 focus:outline-none focus:ring-1 focus:ring-[#B8860B] focus:border-[#B8860B] transition-all shadow-sm font-playfair text-[#2C1E16]"
            placeholder="Tìm kiếm tác phẩm (Hỗ trợ AI)..."
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
              value={sortOption}
              onChange={handleSortChange}
              className="block w-full pl-12 pr-10 py-3 border border-[#D4C4A8] rounded-sm leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-[#B8860B] focus:border-[#B8860B] transition-all shadow-sm font-playfair text-[#2C1E16] appearance-none cursor-pointer"
            >
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

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((product, index) => (
              <div 
                key={product.id} 
                className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both"
                style={{ animationDelay: `${index * 150}ms` }}
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
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-full border border-[#D4C4A8] text-[#8B3A3A] hover:bg-[#F4EBD0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 rounded-full font-playfair font-bold transition-all duration-300 ${
                      currentPage === i + 1
                        ? 'bg-[#8B3A3A] text-white shadow-md scale-110'
                        : 'text-[#5C4033] hover:bg-[#F4EBD0] hover:text-[#8B3A3A]'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)))}
                disabled={currentPage === Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)}
                className="p-2 rounded-full border border-[#D4C4A8] text-[#8B3A3A] hover:bg-[#F4EBD0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
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
              setSortOption('title-asc');
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
