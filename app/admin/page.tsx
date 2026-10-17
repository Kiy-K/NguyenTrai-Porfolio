'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { AuthSkeleton } from '@/components/ContentSkeletons';
import ArticleForm from '@/components/admin/ArticleForm';
import FeedbackPanel from '@/components/admin/FeedbackPanel';
import SecurityActions from '@/components/admin/SecurityActions';

export default function AdminPage() {
  const router = useRouter();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isMutationPending, setIsMutationPending] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAdminSession = async () => {
      try {
        const res = await fetch('/api/admin/auth/status', { cache: 'no-store' });
        if (!res.ok) {
          router.replace('/admin/login');
          return;
        }
      } catch {
        router.replace('/admin/login');
        return;
      }
      if (isMounted) setIsAuthChecking(false);
    };

    checkAdminSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (isAuthChecking) return <AuthSkeleton />;

  return (
    <div className="min-h-screen bg-[#F4EBD0] font-playfair">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SecurityActions isMutationPending={isMutationPending} setIsMutationPending={setIsMutationPending} />
        <FeedbackPanel />
        <ArticleForm isMutationPending={isMutationPending} setIsMutationPending={setIsMutationPending} />
      </main>
      <Footer />
    </div>
  );
}
