'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useCards, type AnswerRecord } from '@/hooks/useCards';
import { type QuizOrder } from '@/lib/db';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { db } from '@/lib/db';
import { seedDatabase } from '@/lib/seedData';
import { FlashCardView } from './FlashCard';
import { TimerBar } from './TimerBar';

const TIMER_MS = 10_000;

// ---- 同期インジケーターアイコン ----
function SyncButton({ pending, syncing, onClick }: {
  pending: number;
  syncing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={syncing}
      title={
        syncing
          ? '同期中...'
          : pending > 0
          ? `${pending}枚が未同期 — クリックして同期`
          : 'すべて同期済み'
      }
      className="relative flex items-center justify-center w-7 h-7 text-gray-500 hover:text-gray-300 disabled:cursor-default transition-colors"
    >
      {syncing ? (
        <svg className="w-4 h-4 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      )}
      {!syncing && pending > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black px-0.5">
          {pending > 99 ? '99+' : pending}
        </span>
      )}
    </button>
  );
}

// ---- 結果一覧（終了画面用）----
function ResultList({ answers }: { answers: AnswerRecord[] }) {
  const ok = answers.filter((a) => a.quality >= 4);
  const fuzzy = answers.filter((a) => a.quality === 3);
  const ng = answers.filter((a) => a.quality < 3);

  const Section = ({
    label,
    color,
    items,
  }: {
    label: string;
    color: string;
    items: AnswerRecord[];
  }) => {
    if (items.length === 0) return null;
    return (
      <div className="flex flex-col gap-1.5">
        <p className={`text-[11px] font-bold uppercase tracking-wider ${color}`}>
          {label}（{items.length}）
        </p>
        {items.map((a, i) => (
          <div
            key={i}
            className="bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2.5 flex flex-col gap-1"
          >
            <p className="text-sm text-white leading-snug">{a.card.front}</p>
            <p className="text-xs text-gray-400 leading-snug">{a.card.back}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <Section label="NG" color="text-red-400" items={ng} />
      <Section label="うろ覚え" color="text-amber-400" items={fuzzy} />
      <Section label="OK" color="text-emerald-400" items={ok} />
    </div>
  );
}

// ---- メインコンポーネント ----
export function QuizScreen({ folderId, limit, order, minWrongCount, startCardId }: {
  folderId?: number;
  limit?: number;
  order?: QuizOrder;
  minWrongCount?: number;
  startCardId?: number;
}) {
  const { currentCard, remaining, loading, error, submitAnswer, reload, answers } = useCards({
    folderId,
    limit,
    order,
    minWrongCount,
    startCardId,
  });
  const { pending, syncing, sync } = useSyncStatus();

  // 初回起動時にカードが0件ならシードデータを投入
  useEffect(() => {
    (async () => {
      const count = await db.flashcards.count();
      if (count === 0) {
        await seedDatabase();
        await reload();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // アプリ起動時に未同期カードをバックグラウンド同期
  useEffect(() => {
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 学習完了時に同期
  const prevCard = useRef(currentCard);
  useEffect(() => {
    if (prevCard.current !== null && currentCard === null && !loading) {
      sync();
    }
    prevCard.current = currentCard;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard, loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-sm">カードを読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <p className="text-sm text-red-400">{error.message}</p>
        <button
          onClick={reload}
          className="mt-4 text-sm text-emerald-400 underline underline-offset-2"
        >
          再試行
        </button>
      </div>
    );
  }

  // ---- 終了画面 ----
  if (!currentCard) {
    const okCount = answers.filter((a) => a.quality >= 4).length;
    const fuzzyCount = answers.filter((a) => a.quality === 3).length;
    const ngCount = answers.filter((a) => a.quality < 3).length;

    return (
      <div className="w-full max-w-sm flex flex-col items-center gap-6 pb-8">
        {/* 完了バッジ */}
        <div className="flex flex-col items-center gap-3 pt-4">
          <div className="w-16 h-16 rounded-full bg-emerald-900/50 border border-emerald-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xl font-bold text-white">学習完了!</p>

          {/* スコアサマリー */}
          {answers.length > 0 && (
            <div className="flex items-center gap-4 mt-1">
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-emerald-400">{okCount}</span>
                <span className="text-[11px] text-gray-500">OK</span>
              </div>
              <div className="w-px h-8 bg-gray-700" />
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-amber-400">{fuzzyCount}</span>
                <span className="text-[11px] text-gray-500">うろ覚え</span>
              </div>
              <div className="w-px h-8 bg-gray-700" />
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-red-400">{ngCount}</span>
                <span className="text-[11px] text-gray-500">NG</span>
              </div>
            </div>
          )}

          {syncing && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              クラウドに同期中...
            </p>
          )}
        </div>

        {/* アクションボタン */}
        <div className="flex gap-3 w-full">
          <button
            onClick={reload}
            className="flex-1 py-3 rounded-xl bg-emerald-700/30 border border-emerald-700/50 text-emerald-400 text-sm font-bold hover:bg-emerald-700/50 transition-colors"
          >
            もう一度
          </button>
          {folderId !== undefined ? (
            <Link
              href={`/folders/${folderId}`}
              className="flex-1 py-3 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-sm font-bold hover:text-white hover:border-gray-600 transition-colors text-center"
            >
              問題集に戻る
            </Link>
          ) : (
            <Link
              href="/"
              className="flex-1 py-3 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-sm font-bold hover:text-white hover:border-gray-600 transition-colors text-center"
            >
              ホームへ戻る
            </Link>
          )}
        </div>

        {/* 今回の結果一覧 */}
        {answers.length > 0 && (
          <div className="w-full flex flex-col gap-3">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">今回の結果一覧</p>
            <ResultList answers={answers} />
          </div>
        )}
      </div>
    );
  }

  // ---- 学習中画面 ----
  return (
    <div className="flex flex-col gap-5 w-full max-w-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-1">
        {folderId !== undefined ? (
          <Link
            href={`/folders/${folderId}`}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-200 hover:text-emerald-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            問題集
          </Link>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-bold text-gray-200 hover:text-emerald-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            ホーム
          </Link>
        )}
        <div className="flex items-center gap-3">
          <SyncButton pending={pending} syncing={syncing} onClick={sync} />
          <span className="text-sm text-gray-400">
            残り <span className="font-bold text-white">{remaining}</span> 枚
          </span>
        </div>
      </div>

      {/* タイマーバー */}
      <TimerBar
        key={`timer-${currentCard.id}`}
        duration={TIMER_MS}
        onTimeout={() => submitAnswer(0)}
      />

      {/* フラッシュカード */}
      <FlashCardView
        key={`card-${currentCard.id}`}
        card={currentCard}
        onAnswer={submitAnswer}
      />
    </div>
  );
}
