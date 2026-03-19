'use client';

import { CldVideoPlayer } from 'next-cloudinary';
import 'next-cloudinary/dist/cld-video-player.css';
import { useState, useEffect } from 'react';

export default function VideoPlayer({ url }: { url: string }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/10">
        <div className="animate-pulse text-[#8B3A3A] font-playfair">Đang tải video...</div>
      </div>
    );
  }

  // CldVideoPlayer needs a unique ID for each player instance on the page
  const playerId = `video-player-${url.replace(/[^a-zA-Z0-9]/g, '-')}`;

  return (
    <div className="w-full h-full absolute top-0 left-0">
      <CldVideoPlayer
        id={playerId}
        src={url}
        width="1920"
        height="1080"
        className="w-full h-full object-cover"
      />
    </div>
  );
}
