'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AutoReloader() {
  const router = useRouter();

  useEffect(() => {
    // Soft refresh every 30 minutes — re-fetches server component data
    // without a hard reload, so it never triggers the beforeunload dialog
    // and never interrupts uploads in progress.
    const interval = setInterval(() => {
      router.refresh();
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
