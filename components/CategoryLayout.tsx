'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { SECTIONS } from '@/lib/constants';
import ProjectList from '@/components/ProjectList';
import { Heart, Leaf, Box, Palette, Gamepad2, Clapperboard, Camera } from 'lucide-react';

// Map sections to icons
const getIconForSection = (id: string) => {
  switch (id) {
    case 'tu-tuong-nhan-nghia': return <Heart className="w-8 h-8 mb-2" />;
    case 'tinh-yeu-thien-nhien': return <Leaf className="w-8 h-8 mb-2" />;
    case 'mo-hinh': return <Box className="w-8 h-8 mb-2" />;
    case 'tranh-ve': return <Palette className="w-8 h-8 mb-2" />;
    case 'tro-choi': return <Gamepad2 className="w-8 h-8 mb-2" />;
    case 'kich': return <Clapperboard className="w-8 h-8 mb-2" />;
    case 'hinh-anh': return <Camera className="w-8 h-8 mb-2" />;
    default: return <Heart className="w-8 h-8 mb-2" />;
  }
};

export default function CategoryLayout({ allProducts }: { allProducts: any[] }) {
  const searchParams = useSearchParams();
  const sectionQuery = searchParams.get('section');
  
  const initialSection = sectionQuery && SECTIONS.some(s => s.id === sectionQuery) 
    ? sectionQuery 
    : SECTIONS[0].id;

  const [selectedSectionId, setSelectedSectionId] = useState(initialSection);

  // Sync with URL changes (e.g., back button)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const section = params.get('section');
      if (section && SECTIONS.some(s => s.id === section)) {
        setSelectedSectionId(section);
      } else {
        setSelectedSectionId(SECTIONS[0].id);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSectionChange = (id: string) => {
    setSelectedSectionId(id); // Instant UI update
    // Update URL without triggering a Next.js server fetch
    window.history.pushState(null, '', `/?section=${id}`);
  };

  const selectedSection = SECTIONS.find(s => s.id === selectedSectionId) || SECTIONS[0];
  
  const filteredProducts = allProducts.filter(
    p => p.section?.toLowerCase() === selectedSection.name.toLowerCase() || (!p.section && selectedSectionId === 'tu-tuong-nhan-nghia')
  );

  return (
    <div className="w-full max-w-5xl mx-auto" id="chuyen-muc">
      {/* Category Selector Card */}
      <div className="bg-white rounded-3xl shadow-md p-8 mb-16 border border-[#D4C4A8]">
        <h2 className="text-xl font-bold text-[#8B3A3A] mb-6 font-playfair uppercase tracking-widest text-center">
          1. Chọn Chuyên Mục
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {SECTIONS.map((section) => {
            const isSelected = selectedSectionId === section.id;
            return (
              <button
                key={section.id}
                onClick={() => handleSectionChange(section.id)}
                className={`group relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-500 ease-out overflow-hidden ${
                  isSelected 
                    ? 'bg-[#8B3A3A] border-[#8B3A3A] text-white shadow-[0_8px_30px_rgb(139,58,58,0.3)] transform scale-105 ring-2 ring-[#8B3A3A] ring-offset-2 ring-offset-white' 
                    : 'bg-white border-[#D4C4A8] text-[#5C4033] hover:border-[#8B3A3A] hover:text-[#8B3A3A] hover:shadow-[0_8px_30px_rgb(139,58,58,0.15)] hover:-translate-y-1'
                }`}
              >
                <div className="transform transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1">
                  {getIconForSection(section.id)}
                </div>
                <span className="text-sm font-bold font-playfair text-center leading-tight relative z-10">
                  {section.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area - Keyed by section ID to trigger animations on change */}
      <div key={selectedSectionId} className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out fill-mode-both">
        {/* Section Title */}
        <div className="text-center mb-12">
          <h3 className="text-4xl font-bold text-[#2C1E16] font-playfair mb-4">
            {selectedSection.name}
          </h3>
          <div className="w-16 h-[2px] bg-[#B8860B] mx-auto"></div>
        </div>

        {/* Content Display */}
        {filteredProducts.length > 0 ? (
          <ProjectList products={filteredProducts} />
        ) : (
          <div className="text-center text-[#5C4033] py-16 mx-auto max-w-2xl border border-[#D4C4A8] rounded-2xl bg-white shadow-sm px-8">
            <div className="text-4xl mb-6 text-[#B8860B]">❦</div>
            <p className="text-xl font-playfair italic mb-6">Chưa có bài viết nào trong chuyên mục này.</p>
            <p className="text-[#8B3A3A] font-playfair mb-8">Hãy là người đầu tiên đóng góp nội dung cho chuyên mục này!</p>
            <a href="/admin" className="inline-block bg-[#8B3A3A] text-white font-bold py-3 px-8 rounded-full hover:bg-[#5C4033] transition-all duration-300 shadow-sm uppercase tracking-wider text-sm font-playfair">
              Thêm bài viết ngay
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
