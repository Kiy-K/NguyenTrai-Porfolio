import type { ReactNode } from 'react';

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton-block rounded-sm ${className}`} />;
}

function LoadingRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p role="status" className="sr-only">{label}</p>
      <div aria-hidden="true" className="skeleton-content">{children}</div>
    </div>
  );
}

export function ProjectListSkeleton() {
  return (
    <LoadingRegion label="Đang tải bài viết trong chuyên mục…">
      <div className="max-w-5xl mx-auto mb-6 flex flex-col md:flex-row gap-4">
        <SkeletonBlock className="h-12 flex-1" />
        <SkeletonBlock className="h-12 md:w-44" />
      </div>
      <div className="max-w-5xl mx-auto mb-12 flex gap-2">
        <SkeletonBlock className="h-8 w-20 rounded-full" />
        <SkeletonBlock className="h-8 w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="border border-[#D4C4A8] rounded-sm overflow-hidden bg-white">
            <SkeletonBlock className="aspect-[16/10] w-full" />
            <div className="p-6 space-y-4">
              <SkeletonBlock className="h-6 w-3/4" />
              <SkeletonBlock className="h-6 w-20" />
              <div className="space-y-2">
                <SkeletonBlock className="h-4 w-full" />
                <SkeletonBlock className="h-4 w-full" />
                <SkeletonBlock className="h-4 w-2/3" />
              </div>
              <div className="border-t border-[#D4C4A8] pt-4">
                <SkeletonBlock className="h-5 w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function ProductSkeleton() {
  return (
    <LoadingRegion label="Đang tải tác phẩm…">
      <div className="bg-white rounded-sm border border-[#D4C4A8] overflow-hidden">
        <SkeletonBlock className="h-64 sm:h-96 w-full" />
        <div className="p-8 sm:p-12 space-y-8">
          <SkeletonBlock className="h-12 w-4/5" />
          <SkeletonBlock className="h-8 w-28" />
          <div className="space-y-3">
            <SkeletonBlock className="h-5 w-full" />
            <SkeletonBlock className="h-5 w-3/4" />
          </div>
          <SkeletonBlock className="h-8 w-48" />
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

export function AuthSkeleton() {
  return (
    <main className="min-h-screen bg-[#F4EBD0] flex items-center justify-center px-6 py-12">
      <section className="w-full max-w-lg bg-white border border-[#D4C4A8] rounded-2xl p-8">
        <LoadingRegion label="Đang xác thực quản trị…">
          <div className="space-y-6">
            <SkeletonBlock className="h-8 w-2/3" />
            <div className="h-px w-16 bg-[#B8860B]" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-3/4" />
          </div>
        </LoadingRegion>
        <p aria-hidden="true" className="mt-6 text-sm text-[#5C4033]">Đang xác thực quản trị…</p>
      </section>
    </main>
  );
}

export function HomeSkeleton() {
  return (
    <LoadingRegion label="Đang tải trang…">
      <div className="text-center mt-4 sm:mt-12 mb-12 sm:mb-24 p-4 sm:p-12 space-y-8">
        <SkeletonBlock className="h-6 w-56 mx-auto" />
        <SkeletonBlock className="h-20 w-3/4 max-w-lg mx-auto" />
        <SkeletonBlock className="h-80 w-full max-w-md mx-auto" />
        <SkeletonBlock className="h-16 w-full max-w-xl mx-auto" />
      </div>
    </LoadingRegion>
  );
}
