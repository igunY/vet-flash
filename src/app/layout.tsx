import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { SwRegister } from '@/components/SwRegister';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

// ---- メタデータ ----
export const metadata: Metadata = {
  title: 'VetFlash — 獣医学フラッシュカード',
  description: '獣医学国家試験対策のための高速フラッシュカードアプリ',
  applicationName: 'VetFlash',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VetFlash',
  },
  formatDetection: { telephone: false },
  manifest: '/manifest.json',
};

// ---- ビューポート（viewport-fit=cover でノッチ対応）----
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#059669',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-900 overscroll-none">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
