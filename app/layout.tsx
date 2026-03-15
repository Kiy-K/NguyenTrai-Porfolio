import type {Metadata} from 'next';
import { Playfair_Display } from 'next/font/google';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import './globals.css'; // Global styles
import AutoReloader from '@/components/AutoReloader';

const playfair = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Nguyễn Trãi - Danh nhân văn hóa thế giới',
  description: 'Tìm hiểu về cuộc đời và sự nghiệp của Nguyễn Trãi',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="vi" className={`${playfair.variable}`}>
      <body suppressHydrationWarning className="font-playfair bg-[#F4EBD0] text-[#2C1E16]">
        <AutoReloader />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
