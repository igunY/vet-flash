'use client';

import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { type QuizOrder } from '@/lib/db';

const QuizScreen = dynamic(
  () => import('@/components/QuizScreen').then((m) => m.QuizScreen),
  { ssr: false },
);

export default function QuizContent() {
  const searchParams = useSearchParams();
  const folderIdParam = searchParams.get('folderId');
  const limitParam = searchParams.get('limit');
  const orderParam = searchParams.get('order') as QuizOrder | null;
  const minWrongCountParam = searchParams.get('minWrongCount');
  const startCardIdParam = searchParams.get('startCardId');

  const folderId = folderIdParam !== null ? Number(folderIdParam) : undefined;
  const limit = limitParam !== null ? Number(limitParam) : undefined;
  const order: QuizOrder = orderParam ?? 'random';
  const minWrongCount = minWrongCountParam !== null ? Number(minWrongCountParam) : 0;
  const startCardId = startCardIdParam !== null ? Number(startCardIdParam) : undefined;

  return (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center px-4 pt-safe pb-safe">
      <QuizScreen
        folderId={folderId}
        limit={limit}
        order={order}
        minWrongCount={minWrongCount}
        startCardId={startCardId}
      />
    </main>
  );
}
