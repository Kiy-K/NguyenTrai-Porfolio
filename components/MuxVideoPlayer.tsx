'use client';

import MuxPlayer from '@mux/mux-player-react';

interface MuxVideoPlayerProps {
  playbackId: string;
}

export default function MuxVideoPlayer({ playbackId }: MuxVideoPlayerProps) {
  return (
    <MuxPlayer
      playbackId={playbackId}
      streamType="on-demand"
      envKey={process.env.NEXT_PUBLIC_MUX_DATA_ENV_KEY}
      style={{ width: '100%', aspectRatio: '16/9' }}
    />
  );
}
