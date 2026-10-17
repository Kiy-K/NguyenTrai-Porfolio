'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { SkeletonBlock } from '@/components/ContentSkeletons';

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
  return <LinkPreviewContent key={url} url={url} />;
}

function LinkPreviewContent({ url }: LinkPreviewProps) {
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

  const isLoading = status === 'loading';

  return (
    <div>
      {isLoading && <p role="status" className="sr-only">Đang tải bản xem trước liên kết…</p>}
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="block overflow-hidden rounded-lg border border-[#D4C4A8] bg-white hover:shadow-md transition-shadow motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8B3A3A]"
      >
        <div className="relative h-48 w-full bg-[#F4EBD0] overflow-hidden">
          {metadata?.image ? (
            <Image
              src={metadata.image}
              alt={metadata.title || metadata.siteName || 'Ảnh xem trước liên kết'}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              referrerPolicy="no-referrer"
            />
          ) : isLoading ? (
            <div className="skeleton-content h-full"><SkeletonBlock className="h-full w-full" /></div>
          ) : (
            <div aria-hidden="true" className="flex h-full items-center justify-center px-6 text-[#8B3A3A] break-all text-center">
              {getHostname(url)}
            </div>
          )}
        </div>
        <div className="min-h-44 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8B3A3A] truncate">
            {metadata?.siteName || getHostname(url)}
          </p>
          <h4 className="mt-1 text-lg font-bold text-[#2C1E16] line-clamp-2 break-words">
            {metadata?.title || url}
          </h4>
          {isLoading ? (
            <div aria-hidden="true" className="skeleton-content mt-3 space-y-2">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-3/4" />
            </div>
          ) : metadata?.description ? (
            <p className="mt-2 text-sm text-[#5C4033] line-clamp-3">{metadata.description}</p>
          ) : status === 'error' ? (
            <p className="mt-2 text-sm text-[#5C4033]">Không thể tải bản xem trước. Mở liên kết để đọc tiếp.</p>
          ) : null}
        </div>
      </a>
    </div>
  );
}
