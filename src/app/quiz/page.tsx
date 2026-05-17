import { Suspense } from 'react';
import QuizContent from './QuizContent';

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </main>
      }
    >
      <QuizContent />
    </Suspense>
  );
}
