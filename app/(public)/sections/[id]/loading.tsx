import Footer from '@/components/Footer';
import BackButton from '@/components/BackButton';
import { ProjectListSkeleton, SkeletonBlock } from '@/components/ContentSkeletons';

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-grow w-full">
        <div className="mb-12 space-y-4">
          <BackButton fallbackUrl="/" label="Về trang chủ" />
          <div className="skeleton-content">
            <SkeletonBlock className="h-10 w-2/3 max-w-md mx-auto" />
          </div>
        </div>
        <ProjectListSkeleton />
      </main>
      <Footer />
    </div>
  );
}
