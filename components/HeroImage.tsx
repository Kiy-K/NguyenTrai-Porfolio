'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function HeroImage() {
  const [imgSrc, setImgSrc] = useState('/nguyen-trai.jpg');

  return (
    <div className="relative w-48 h-48 md:w-56 md:h-56 rounded-full overflow-hidden border-4 border-[#D4C4A8] shadow-lg mb-8 bg-[#E8D8B8]">
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
