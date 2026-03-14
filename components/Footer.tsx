'use client';

import { useState, useEffect } from 'react';

const quotes = [
  "Việc nhân nghĩa cốt ở yên dân / Quân điếu phạt trước lo trừ bạo.",
  "Tuy mạnh yếu từng lúc khác nhau / Song hào kiệt đời nào cũng có.",
  "Đem đại nghĩa để thắng hung tàn / Lấy chí nhân để thay cường bạo.",
  "Côn Sơn suối chảy rì rầm / Ta nghe như tiếng đàn cầm bên tai.",
  "Bui một tấc lòng ưu ái cũ / Đêm ngày cuồn cuộn nước triều đông.",
  "Góc thành Nam lều một gian / No nước uống, thiếu cơm ăn.",
  "Nước biếc non xanh thuyền gối bãi / Đêm thanh nguyệt bạc khách lên lầu."
];

export default function Footer() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setQuoteIndex((prev) => (prev + 1) % quotes.length);
        setFade(true);
      }, 500); // Wait for fade out
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="bg-[#2C1E16] text-[#F4EBD0] mt-auto font-playfair">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center">
          <div className="text-[#B8860B] text-xl mb-4 opacity-80">✦</div>
          
          <div className={`text-center max-w-2xl mx-auto text-xl italic mb-8 transition-opacity duration-1000 font-playfair leading-relaxed ${fade ? 'opacity-100' : 'opacity-0'}`}>
            &quot;{quotes[quoteIndex]}&quot;
          </div>
          
          <div className="w-24 h-[1px] bg-[#B8860B] opacity-50 mb-6"></div>
          
          <p className="text-center text-sm text-[#F4EBD0]/70 uppercase tracking-wider">
            &copy; 2026 Tìm hiểu về Nguyễn Trãi.
          </p>
        </div>
      </div>
    </footer>
  );
}
