import Footer from '@/components/Footer';
import CategoryLayout from '@/components/CategoryLayout';
import HeroImage from '@/components/HeroImage';
import HomeProjectOverviewFeedback from '@/components/HomeProjectOverviewFeedback';

export const revalidate = 1800; // Cache for 30 minutes

export default async function Home() {
  return (
    <div className="flex-1 bg-[#F4EBD0] font-playfair flex flex-col">
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex-grow w-full relative">
        {/* Hero Section */}
        <div className="text-center mt-4 sm:mt-12 mb-12 sm:mb-24 relative p-4 sm:p-12 motion-safe:animate-in motion-safe:fade-in duration-500 ease-out">
          <h1 className="text-4xl font-bold text-[#2C1E16] sm:text-6xl lg:text-7xl font-playfair mb-6 leading-tight">
            <span className="block text-xl text-[#8B3A3A] mb-4 font-playfair italic tracking-widest">- Danh Nhân Văn Hóa -</span>
            Nguyễn Trãi
          </h1>
          
          <div className="w-24 h-[1px] bg-[#B8860B] mx-auto my-8"></div>
          
          <div className="flex flex-col items-center justify-center mb-8">
            <HeroImage />
            <p className="max-w-3xl mx-auto text-xl sm:text-2xl text-[#5C4033] italic font-playfair leading-relaxed">
              &quot;Việc nhân nghĩa cốt ở yên dân<br/>
              Quân điếu phạt trước lo trừ bạo&quot;
            </p>
          </div>
        </div>

        {/* Project Overview Section */}
        <div className="relative">
          <HomeProjectOverviewFeedback mode="overview" />
        </div>

        {/* Category Layout */}
        <CategoryLayout />

        {/* Feedback Section */}
        <div className="relative">
          <HomeProjectOverviewFeedback mode="feedback" />
        </div>
      </main>

      <Footer />
    </div>
  );
}
