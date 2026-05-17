'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

interface TimerBarProps {
  duration: number; // ms
  onTimeout: () => void;
}

export function TimerBar({ duration, onTimeout }: TimerBarProps) {
  const progress = useMotionValue(1);
  // 残り時間に応じて緑→黄→赤へ変色
  const backgroundColor = useTransform(
    progress,
    [0, 0.3, 0.6, 1],
    ['#ef4444', '#f59e0b', '#eab308', '#10b981'],
  );
  // onTimeout が毎レンダーで変わっても最新を使えるよう ref で保持
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    progress.set(1);
    const controls = animate(progress, 0, {
      duration: duration / 1000,
      ease: 'linear',
      onComplete: () => onTimeoutRef.current(),
    });
    return () => controls.stop();
    // 親が key={card.id} でリマウントするためここは空配列で問題なし
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
      <motion.div
        className="h-full origin-left rounded-full"
        style={{ scaleX: progress, backgroundColor }}
      />
    </div>
  );
}
