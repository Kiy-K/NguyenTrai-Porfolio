'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

interface ShareButtonProps {
  url: string;
}

export default function ShareButton({ url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating if this button is placed near a link
    try {
      // Construct full URL if it's a relative path
      const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="group relative inline-flex items-center justify-center p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all duration-300 hover:shadow-sm active:scale-90"
      title="Chia sẻ"
    >
      {copied ? (
        <Check className="w-4 h-4 text-emerald-600 animate-in zoom-in duration-300" />
      ) : (
        <Share2 className="w-4 h-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" />
      )}
    </button>
  );
}
