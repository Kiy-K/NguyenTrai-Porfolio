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

type PreviewStatus = 'loading' | 'success' | 'error';

const previewDataCache = new Map<string, PreviewMetadata>();
const inflightPreviewRequests = new Map<string, Promise<PreviewMetadata>>();

const getHostname = (value: string): string => {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
};

const fetchPreviewMetadata = (url: string): Promise<PreviewMetadata> => {
  const cached = previewDataCache.get(url);
  if (cached) return Promise.resolve(cached);

  const inflight = inflightPreviewRequests.get(url);
  if (inflight) return inflight;

  const promise = fetch(`/api/preview?url=${encodeURIComponent(url)}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('Unable to fetch preview metadata');
      }
      const data = (await response.json()) as PreviewMetadata;
      previewDataCache.set(url, data);
      return data;
    })
    .finally(() => {
      inflightPreviewRequests.delete(url);
    });

  inflightPreviewRequests.set(url, promise);
  return promise;
};

export default function LinkPreview({ url }: LinkPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialMetadata = previewDataCache.get(url) ?? null;
  const [status, setStatus] = useState<PreviewStatus>(initialMetadata ? 'success' : 'loading');
  const [metadata, setMetadata] = useState<PreviewMetadata | null>(initialMetadata);

  useEffect(() => {
    if (status !== 'loading') return;

    let isActive = true;
    fetchPreviewMetadata(url)
      .then((data) => {
        if (!isActive) return;
        setMetadata(data);
        setStatus('success');
      })
      .catch(() => {
        if (!isActive) return;
        setStatus('error');
      });

    return () => {
      isActive = false;
    };
  }, [status, url]);

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
      <div ref={containerRef}>
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[#8B3A3A] underline break-all"
        >
          {url}
        </a>
        <p className="mt-2 text-xs text-[#5C4033]">Loading preview...</p>
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
