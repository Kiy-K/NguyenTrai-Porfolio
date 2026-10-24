import type {Metadata} from 'next';
import { PRODUCTION_ORIGIN } from '@/lib/seo';
import { Playfair_Display } from 'next/font/google';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import './globals.css'; // Global styles
import AutoReloader from '@/components/AutoReloader';
import ElevenLabsConvaiWidget from '@/components/ElevenLabsConvaiWidget';

const playfair = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCTION_ORIGIN),
  robots: { index: false, follow: false },
  title: 'Nguyễn Trãi - Danh nhân văn hóa thế giới',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="vi" data-scroll-behavior="smooth" className={`${playfair.variable}`}>
      <body suppressHydrationWarning className="font-playfair bg-[#F4EBD0] text-[#2C1E16]">
        <AutoReloader />
        {children}
        <ElevenLabsConvaiWidget />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
