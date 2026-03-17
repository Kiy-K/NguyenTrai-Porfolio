import Link from 'next/link';
import { SECTIONS } from '@/lib/constants';
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

export default function CategoryLayout() {
  return (
    <div className="w-full max-w-5xl mx-auto" id="chuyen-muc">
      <div className="bg-white rounded-3xl shadow-md p-8 mb-16 border border-[#D4C4A8]">
        <h2 className="text-xl font-bold text-[#8B3A3A] mb-6 font-playfair uppercase tracking-widest text-center">
          1. Chọn Chuyên Mục
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {SECTIONS.map((section) => (
            <Link
              key={section.id}
              href={section.path}
              className="group relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-500 ease-out overflow-hidden bg-white border-[#D4C4A8] text-[#5C4033] hover:border-[#8B3A3A] hover:text-[#8B3A3A] hover:shadow-[0_8px_30px_rgb(139,58,58,0.15)] hover:-translate-y-1"
            >
              <div className="transform transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1">
                {getIconForSection(section.id)}
              </div>
              <span className="text-sm font-bold font-playfair text-center leading-tight relative z-10">
                {section.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
