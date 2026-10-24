import JsonLd from '@/components/JsonLd';
import { breadcrumbs, sectionMetadata } from '@/lib/seo';

import { Suspense } from 'react';
import { ProjectListSkeleton } from '@/components/ContentSkeletons';
import { notFound } from 'next/navigation';
import { getProducts } from '@/lib/data';
import { SECTIONS } from '@/lib/constants';
import Footer from '@/components/Footer';
import ProjectList from '@/components/ProjectList';
import BackButton from '@/components/BackButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const section = SECTIONS.find(section => section.id === id);
  if (!section) notFound();
  return sectionMetadata(section);
}


export default async function SectionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const sectionId = resolvedParams.id;
  
  const section = SECTIONS.find(s => s.id === sectionId);
  
  if (!section) {
    notFound();
  }

  return (
    <div className="flex-1 bg-[#F4EBD0] font-playfair flex flex-col">
      <JsonLd data={breadcrumbs([{ name: section.name, path: section.path }])} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex-grow w-full relative">
        <div className="w-full">
          {/* Section Title */}
          <div className="flex flex-col items-start sm:items-center sm:justify-center gap-4 mb-12 relative">
            <div className="sm:absolute sm:left-0">
              <BackButton fallbackUrl="/" label="Về trang chủ" />
            </div>
            <div className="text-center w-full sm:px-40">
              <h1 className="text-3xl sm:text-4xl font-bold text-[#2C1E16] font-playfair leading-tight break-words mb-4">
                {section.name}
              </h1>
              <div className="w-16 h-[2px] bg-[#B8860B] mx-auto"></div>
            </div>
          </div>

          <Suspense fallback={<ProjectListSkeleton />}>
            <SectionProducts sectionId={sectionId} sectionName={section.name} />
          </Suspense>
        </div>
      </main>

      <Footer />
    </div>
  );
}

async function SectionProducts({ sectionId, sectionName }: { sectionId: string; sectionName: string }) {
  const allProducts = await getProducts();
  const filteredProducts = allProducts.filter(
    p => p.section?.toLowerCase() === sectionName.toLowerCase() || (!p.section && sectionId === 'tu-tuong-nhan-nghia')
  );

  return (
    filteredProducts.length > 0 ? (
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
          )
  );
}
