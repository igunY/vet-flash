export interface SM2State {
  repetitions: number; // 連続正解回数 (n)
  easeFactor: number;  // 易しさ係数 (EF)
  interval: number;    // 次回までの間隔（日数）(I)
}

/**
 * SM-2アルゴリズムに基づく次回学習スケジュールの計算
 * @param quality ユーザーの評価 (0: 完全に忘れた 〜 5: 完璧に思い出した)
 * @param previousState 前回のステート（新規カードの場合は初期値を渡す）
 */
export function calculateSM2(quality: number, previousState: SM2State): SM2State {
  const q = Math.max(0, Math.min(5, quality));

  let { repetitions, easeFactor, interval } = { ...previousState };

  // EF を先に更新する（新しいEFをinterval計算に使うため）
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  // 不正解 (q < 3): 連続正解回数をリセットし、インターバルは1日
  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    // 正解 (q >= 3): 新しいEFでintervalを計算
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }

  return { repetitions, easeFactor, interval };
}

export const INITIAL_SM2_STATE: SM2State = {
  repetitions: 0,
  easeFactor: 2.5,
  interval: 1,
};
