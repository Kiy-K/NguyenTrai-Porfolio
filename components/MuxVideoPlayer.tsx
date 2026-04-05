'use client';

import { useState, useEffect } from 'react';
import MuxPlayer from '@mux/mux-player-react';

interface MuxVideoPlayerProps {
  playbackId: string;
}

export default function MuxVideoPlayer({ playbackId }: MuxVideoPlayerProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full aspect-video bg-[#2C1E16]/10 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#B8860B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <MuxPlayer
      playbackId={playbackId}
      streamType="on-demand"
      envKey={process.env.NEXT_PUBLIC_MUX_DATA_ENV_KEY}
      style={{ width: '100%', aspectRatio: '16/9' }}
    />
  );
}
