'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  type FlashCard,
  type QuizOrder,
  getCardsForQuiz,
  updateCardAfterReview,
} from '@/lib/db';

export interface AnswerRecord {
  card: FlashCard;
  quality: number;
}

interface UseCardsOptions {
  folderId?: number;
  limit?: number;
  order?: QuizOrder;
  minWrongCount?: number;
  startCardId?: number;
}

interface UseCardsReturn {
  currentCard: FlashCard | null;
  remaining: number;
  loading: boolean;
  error: Error | null;
  submitAnswer: (quality: number) => void;
  reload: () => Promise<void>;
  answers: AnswerRecord[];
}

export function useCards({
  folderId,
  limit,
  order,
  minWrongCount,
  startCardId,
}: UseCardsOptions = {}): UseCardsReturn {
  const [queue, setQueue] = useState<FlashCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);

  const fetchCards = useCallback(async (): Promise<FlashCard[]> => {
    const cards = await getCardsForQuiz({ folderId, limit, order, minWrongCount, startCardId });
    cards.forEach((card) => {
      if (card.imageUrl) {
        const img = new Image();
        img.src = card.imageUrl;
      }
    });
    return cards;
  }, [folderId, limit, order, minWrongCount, startCardId]);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAnswers([]);
      const cards = await fetchCards();
      setQueue(cards);
      setCurrentIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('カードの読み込みに失敗しました'));
    } finally {
      setLoading(false);
    }
  }, [fetchCards]);

  useEffect(() => {
    reload();
  }, [reload]);

  const submitAnswer = useCallback(
    (quality: number) => {
      const current = queue[currentIndex];
      if (!current?.id) return;
      setAnswers((prev) => [...prev, { card: current, quality }]);
      updateCardAfterReview(current.id, quality).catch(console.error);
      setCurrentIndex((prev) => prev + 1);
    },
    [queue, currentIndex],
  );

  const remaining = queue.length - currentIndex;
  const currentCard = remaining > 0 ? (queue[currentIndex] ?? null) : null;

  return { currentCard, remaining, loading, error, submitAnswer, reload, answers };
}
