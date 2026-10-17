import Footer from '@/components/Footer';
import { HomeSkeleton } from '@/components/ContentSkeletons';

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-grow w-full">
        <HomeSkeleton />
      </main>
      <Footer />
    </div>
  );
}
