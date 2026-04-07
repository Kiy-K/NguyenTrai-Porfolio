'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface PreviewMetadata {
  url: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
}

interface LinkPreviewProps {
  url: string;
}

type PreviewStatus = 'idle' | 'loading' | 'success' | 'error';

const getHostname = (value: string): string => {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
};

export default function LinkPreview({ url }: LinkPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [metadata, setMetadata] = useState<PreviewMetadata | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad || status !== 'idle') return;

    let isActive = true;
    const controller = new AbortController();

    const loadPreview = async () => {
      try {
        setStatus('loading');
        const response = await fetch(`/api/preview?url=${encodeURIComponent(url)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Unable to fetch preview metadata');
        }

        const data = (await response.json()) as PreviewMetadata;
        if (!isActive) return;

        setMetadata(data);
        setStatus('success');
      } catch {
        if (!isActive) return;
        setStatus('error');
      }
    };

    loadPreview();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [shouldLoad, status, url]);

  if (status === 'success' && metadata) {
    return (
      <div ref={containerRef}>
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="block overflow-hidden rounded-lg border border-[#D4C4A8] bg-white hover:shadow-md transition-shadow"
        >
          {metadata.image && (
            <div className="relative h-48 w-full bg-[#F4EBD0]">
              <Image
                src={metadata.image}
                alt={metadata.title || metadata.siteName || 'Link preview image'}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8B3A3A]">
              {metadata.siteName || getHostname(url)}
            </p>
            <h4 className="mt-1 text-lg font-bold text-[#2C1E16]">
              {metadata.title || url}
            </h4>
            {metadata.description && (
              <p className="mt-2 text-sm text-[#5C4033] line-clamp-3">{metadata.description}</p>
            )}
          </div>
        </a>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div ref={containerRef} className="rounded-lg border border-[#D4C4A8] bg-white p-4 animate-pulse">
        <div className="h-4 w-1/3 bg-[#D4C4A8] rounded" />
        <div className="mt-3 h-4 w-5/6 bg-[#D4C4A8] rounded" />
        <div className="mt-2 h-4 w-2/3 bg-[#D4C4A8] rounded" />
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="text-[#8B3A3A] underline break-all"
      >
        {url}
      </a>
    </div>
  );
}
