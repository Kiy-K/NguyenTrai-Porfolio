'use client';

import Script from 'next/script';
import { createElement } from 'react';

const ELEVENLABS_AGENT_ID = 'agent_3401knm1gpdyehwt9tb5kj9j1znc';

export default function ElevenLabsConvaiWidget() {
  return (
    <>
      <Script
        src="https://unpkg.com/@elevenlabs/convai-widget-embed"
        strategy="afterInteractive"
        type="text/javascript"
      />
      {createElement('elevenlabs-convai', { 'agent-id': ELEVENLABS_AGENT_ID })}
    </>
  );
}
