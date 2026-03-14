import { getProducts } from '@/lib/data';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import CategoryLayout from '@/components/CategoryLayout';
import { Suspense } from 'react';

export const revalidate = 900; // Cache for 15 minutes

export default async function Home() {
  // Lấy danh sách sản phẩm từ Redis hoặc dữ liệu mẫu
  const allProducts = await getProducts();

  return (
    <div className="min-h-screen bg-[#F4EBD0] font-playfair flex flex-col">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-grow w-full relative">
        {/* Hero Section */}
        <div className="text-center mt-12 mb-24 relative p-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <h1 className="text-5xl font-bold text-[#2C1E16] sm:text-6xl lg:text-7xl font-playfair mb-6 tracking-wide">
            <span className="block text-xl text-[#8B3A3A] mb-4 font-playfair italic tracking-widest animate-in fade-in duration-1000 delay-300 fill-mode-both">- Danh Nhân Văn Hóa -</span>
            Nguyễn Trãi
          </h1>
          
          <div className="w-24 h-[1px] bg-[#B8860B] mx-auto my-8 animate-in zoom-in duration-700 delay-500 fill-mode-both"></div>
          
          <p className="max-w-3xl mx-auto text-2xl text-[#5C4033] italic font-playfair leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-700 fill-mode-both">
            &quot;Việc nhân nghĩa cốt ở yên dân<br/>
            Quân điếu phạt trước lo trừ bạo&quot;
          </p>
        </div>

        {/* Category Layout */}
        <Suspense fallback={<div className="text-center py-12 text-[#8B3A3A]">Đang tải...</div>}>
          <CategoryLayout allProducts={allProducts} />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
