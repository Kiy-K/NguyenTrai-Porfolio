import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export default function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#F4EBD0] flex flex-col font-playfair">
      <Navigation />
      <main className="flex-grow flex flex-col items-center justify-center">
        <div className="relative w-24 h-24">
          {/* Outer spinning ring */}
          <div className="absolute inset-0 border-4 border-[#D4C4A8] rounded-full"></div>
          <div className="absolute inset-0 border-4 border-[#B8860B] rounded-full border-t-transparent animate-spin"></div>
          
          {/* Inner pulsing dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 bg-[#8B3A3A] rounded-full animate-pulse"></div>
          </div>
        </div>
        <p className="mt-6 text-xl font-bold text-[#2C1E16] animate-pulse tracking-wider">
          Đang tải dữ liệu...
        </p>
      </main>
      <Footer />
    </div>
  );
}
