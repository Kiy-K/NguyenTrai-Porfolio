'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function HeroImage() {
  const [imgSrc, setImgSrc] = useState('/nguyen-trai.jpg');

  return (
    <div className="relative w-48 h-48 md:w-56 md:h-56 rounded-full overflow-hidden border-4 border-[#D4C4A8] shadow-lg mb-8 bg-[#E8D8B8] hover:scale-105 hover:shadow-2xl hover:border-[#B8860B] transition-all duration-[1500ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]">
      <Image 
        src={imgSrc}
        alt="Chân dung Nguyễn Trãi"
        fill
        className="object-cover object-top"
        referrerPolicy="no-referrer"
        unoptimized={imgSrc.startsWith('http')}
        onError={() => {
          // Fallback to wikimedia if local image is not uploaded yet
          if (imgSrc === '/nguyen-trai.jpg') {
            setImgSrc('https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Nguyen_Trai.jpg/220px-Nguyen_Trai.jpg');
          }
        }}
      />
    </div>
  );
}
