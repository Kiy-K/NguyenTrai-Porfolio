import BackButton from '@/components/BackButton';
import { ProductSkeleton } from '@/components/ContentSkeletons';

export default function Loading() {
  return (
    <div className="flex-1">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8"><BackButton /></div>
        <ProductSkeleton />
      </main>
    </div>
  );
}
