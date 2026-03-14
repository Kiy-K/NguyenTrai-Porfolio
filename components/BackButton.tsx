'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function BackButton({ fallbackUrl = '/' }: { fallbackUrl?: string }) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1 && document.referrer.includes(window.location.host)) {
        router.back();
      } else {
        router.push(fallbackUrl);
      }
    }
  };

  return (
    <button 
      onClick={handleBack} 
      className="inline-flex items-center text-lg font-medium text-[#8B3A3A] hover:text-[#B8860B] transition-colors font-playfair p-2 -ml-2 rounded-md active:bg-[#D4C4A8]/30"
      aria-label="Quay lại"
    >
      <ArrowLeft className="mr-2 w-5 h-5" />
      Quay lại
    </button>
  );
}
