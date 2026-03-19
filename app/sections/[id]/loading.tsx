export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F4EBD0] font-playfair flex flex-col items-center justify-center">
      <div className="text-center animate-pulse">
        <div className="text-4xl mb-6 text-[#B8860B]">❦</div>
        <h2 className="text-2xl font-bold text-[#8B3A3A] mb-4 font-playfair">Đang tải chuyên mục...</h2>
        <div className="w-16 h-[2px] bg-[#B8860B] mx-auto"></div>
      </div>
    </div>
  );
}
