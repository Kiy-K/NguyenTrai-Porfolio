import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getProduct } from '@/lib/data';
import Navigation from '@/components/Navigation';
import SummarizeButton from '@/components/SummarizeButton';
import ShareButton from '@/components/ShareButton';
import VideoPlayer from '@/components/VideoPlayer';
import MuxVideoPlayer from '@/components/MuxVideoPlayer';
import BackButton from '@/components/BackButton';

export const revalidate = 900; // Cache for 15 minutes

export default async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  // Lấy dữ liệu sản phẩm từ Redis
  const product = await getProduct(resolvedParams.id);

  if (!product) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#F4EBD0] font-playfair">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back button */}
        <div className="mb-8 animate-in fade-in slide-in-from-left-4 duration-500">
          <BackButton />
        </div>

        <div className="bg-white rounded-sm shadow-sm border border-[#D4C4A8] overflow-hidden relative animate-in fade-in slide-in-from-bottom-8 duration-700">
          {/* Main Image */}
          {product.images && product.images.length > 0 && (
            <div className="relative h-64 sm:h-96 w-full bg-[#F4EBD0] border-b border-[#D4C4A8]">
              <Image
                src={product.images[0]}
                alt={product.title}
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover"
                referrerPolicy="no-referrer"
                priority
              />
            </div>
          )}

          <div className="p-8 sm:p-12">
            <div className="flex items-start justify-between mb-6">
              <h1 className="text-4xl sm:text-5xl font-bold text-[#2C1E16] font-playfair leading-tight">
                {product.title}
              </h1>
              <div className="ml-4">
                <ShareButton url={`/products/${product.id}`} />
              </div>
            </div>
            
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-8">
                {product.tags.map((tag, index) => (
                  <span 
                    key={index} 
                    className="inline-flex items-center px-3 py-1 rounded-sm text-sm font-bold uppercase tracking-wider bg-[#F4EBD0] text-[#8B3A3A] border border-[#D4C4A8]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            
            <p className="text-xl text-[#5C4033] mb-10 italic leading-relaxed pl-6 border-l-2 border-[#B8860B]">
              {product.description}
            </p>

            <div className="prose prose-lg max-w-none mb-12 text-[#2C1E16] font-playfair">
              <h2 className="text-2xl font-bold text-[#2C1E16] mb-6 font-playfair border-b border-[#D4C4A8] pb-2">Về tác phẩm này</h2>
              <p className="text-[#2C1E16] leading-loose text-lg">
                {product.fullDescription || product.description}
              </p>
              
              {/* AI Summarization Feature */}
              <div className="mt-8">
                <SummarizeButton text={product.fullDescription || product.description} />
              </div>
            </div>

            {/* Additional Images Gallery */}
            {product.images && product.images.length > 1 && (
              <div className="mb-12">
                <h3 className="text-2xl font-bold text-[#2C1E16] mb-6 font-playfair border-b border-[#D4C4A8] pb-2">Thư viện ảnh</h3>
                <div className="grid grid-cols-2 gap-6">
                  {product.images.slice(1).map((img, index) => (
                    <div key={index} className="relative h-56 rounded-sm overflow-hidden bg-[#F4EBD0] border border-[#D4C4A8] shadow-sm hover:shadow-md transition-shadow">
                      <Image
                        src={img}
                        alt={`${product.title} gallery image ${index + 1}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Video Section — Mux takes priority; falls back to Cloudinary URL */}
            {(product.muxPlaybackId || product.video) && (
              <div className="mb-12">
                <h3 className="text-2xl font-bold text-[#2C1E16] mb-6 font-playfair border-b border-[#D4C4A8] pb-2">Video giới thiệu</h3>
                <div className="rounded-sm overflow-hidden bg-black aspect-video relative border border-[#D4C4A8] shadow-lg">
                  {product.muxPlaybackId ? (
                    <MuxVideoPlayer playbackId={product.muxPlaybackId} />
                  ) : (
                    <VideoPlayer url={product.video!} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
