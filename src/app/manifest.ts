import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VetFlash — 獣医学フラッシュカード',
    short_name: 'VetFlash',
    description: '獣医学国家試験対策のための高速フラッシュカードアプリ',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#111827',
    theme_color: '#059669',
    categories: ['education'],
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [],
  };
}
