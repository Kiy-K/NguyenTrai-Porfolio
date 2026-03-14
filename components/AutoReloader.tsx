'use client';

import { useEffect } from 'react';

export default function AutoReloader() {
  useEffect(() => {
    const interval = setInterval(() => {
      window.location.reload();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  return null;
}
