import { notFound } from 'next/navigation';
import { getProducts } from '@/lib/data';
import { SECTIONS } from '@/lib/constants';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import ProjectList from '@/components/ProjectList';
import BackButton from '@/components/BackButton';

export const revalidate = 900; // Cache for 15 minutes

export default async function SectionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const sectionId = resolvedParams.id;
  
  const section = SECTIONS.find(s => s.id === sectionId);
  
  if (!section) {
    notFound();
  }

  const allProducts = await getProducts();
  const filteredProducts = allProducts.filter(
    p => p.section?.toLowerCase() === section.name.toLowerCase() || (!p.section && sectionId === 'tu-tuong-nhan-nghia')
  );

  return (
    <div className="min-h-screen bg-[#F4EBD0] font-playfair flex flex-col">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-grow w-full relative">
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-[1200ms] ease-out fill-mode-both">
          {/* Section Title */}
          <div className="flex items-center justify-center gap-4 mb-12 relative">
            <div className="absolute left-0">
              <BackButton fallbackUrl="/" label="Về trang chủ" />
            </div>
            <div className="text-center">
              <h1 className="text-4xl font-bold text-[#2C1E16] font-playfair mb-4">
                {section.name}
              </h1>
              <div className="w-16 h-[2px] bg-[#B8860B] mx-auto"></div>
            </div>
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
      </main>

      <Footer />
    </div>
  );
}
