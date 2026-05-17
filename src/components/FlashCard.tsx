'use client';

import { useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
  type PanInfo,
} from 'framer-motion';
import type { FlashCard } from '@/lib/db';

interface FlashCardViewProps {
  card: FlashCard;
  onAnswer: (quality: number) => void;
}

const SWIPE_THRESHOLD = 90; // px

export function FlashCardView({ card, onAnswer }: FlashCardViewProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-10, 10]);
  // スワイプ方向のオーバーレイ表示
  const ngOpacity = useTransform(x, [-150, -40, 0], [1, 0, 0]);
  const perfectOpacity = useTransform(x, [0, 40, 150], [0, 0, 1]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      animate(x, -520, { duration: 0.22 }).then(() => onAnswer(1));
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      animate(x, 520, { duration: 0.22 }).then(() => onAnswer(5));
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 38 });
    }
  };

  const handleScoreButton = (quality: number) => {
    const dir = quality >= 3 ? 520 : -520;
    animate(x, dir, { duration: 0.18 }).then(() => onAnswer(quality));
  };

  return (
    // 入場アニメーション（key切り替えのたびにリマウントされる）
    <motion.div
      className="flex flex-col items-center gap-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {/* ドラッグ可能なカード */}
      <div className="w-full max-w-sm" style={{ perspective: '1200px' }}>
        <motion.div
          drag={isFlipped ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.55}
          style={{ x, rotate }}
          onDragEnd={handleDragEnd}
          onTap={() => !isFlipped && setIsFlipped(true)}
          className="relative cursor-pointer select-none"
        >
          {/* NG オーバーレイ */}
          <motion.div
            className="absolute inset-0 z-10 rounded-2xl bg-red-500/25 flex items-center justify-center pointer-events-none"
            style={{ opacity: ngOpacity }}
          >
            <span className="text-4xl font-black text-red-300">NG</span>
          </motion.div>

          {/* 完璧 オーバーレイ */}
          <motion.div
            className="absolute inset-0 z-10 rounded-2xl bg-emerald-500/25 flex items-center justify-center pointer-events-none"
            style={{ opacity: perfectOpacity }}
          >
            <span className="text-4xl font-black text-emerald-300">完璧!</span>
          </motion.div>

          {/* 3D フリップコンテナ */}
          <motion.div
            className="relative h-56 w-full"
            style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* 表面 */}
            <div
              className="absolute inset-0 rounded-2xl bg-gray-800 border border-gray-700 shadow-2xl flex flex-col items-center justify-center gap-3 p-6"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">
                {card.category}
              </span>
              <p className="text-xl font-bold text-white text-center leading-snug">
                {card.front}
              </p>
              <span className="mt-1 text-[11px] text-gray-500">タップしてめくる</span>
            </div>

            {/* 裏面 */}
            <div
              className="absolute inset-0 rounded-2xl bg-emerald-950 border border-emerald-800 shadow-2xl flex flex-col items-center justify-center gap-4 p-6"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              {card.imageUrl && (
                <img
                  src={card.imageUrl}
                  alt=""
                  className="h-16 w-auto object-contain rounded-lg"
                />
              )}
              <p className="text-base text-white text-center leading-relaxed">{card.back}</p>
              <p className="text-[10px] text-emerald-600 mt-1">← NG　スワイプで回答　完璧 →</p>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* スコアボタン（裏返し後に表示） */}
      <AnimatePresence>
        {isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16 }}
            className="flex gap-3 w-full max-w-sm"
          >
            {SCORE_BUTTONS.map(({ label, hint, quality, style }) => (
              <button
                key={quality}
                onClick={() => handleScoreButton(quality)}
                className={`flex-1 border rounded-xl py-3 px-2 flex flex-col items-center gap-0.5 transition-colors active:scale-95 ${style}`}
              >
                <span className="text-sm font-bold">{label}</span>
                <span className="text-[10px] opacity-60">{hint}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const SCORE_BUTTONS = [
  {
    label: 'NG',
    hint: '← スワイプ',
    quality: 1,
    style:
      'bg-red-600/20 border-red-600/40 text-red-400 hover:bg-red-600/35',
  },
  {
    label: 'うろ覚え',
    hint: 'ヒントがあれば',
    quality: 3,
    style:
      'bg-amber-600/20 border-amber-600/40 text-amber-400 hover:bg-amber-600/35',
  },
  {
    label: '瞬殺!',
    hint: '→ スワイプ',
    quality: 5,
    style:
      'bg-emerald-600/20 border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/35',
  },
] as const;
