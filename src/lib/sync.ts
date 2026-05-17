import { supabase, ensureSession } from './supabase';
import { db, getUnsyncedCards } from './db';

// 並列実行防止フラグ（モジュールスコープ）
let running = false;

type SupabaseRow = {
  id?: string;          // remoteId がある場合のみ含める（PK upsert）
  user_id: string;
  local_id: number;
  front: string;
  back: string;
  category: string;
  image_url: string | null;
  repetitions: number;
  ease_factor: number;
  interval: number;
  next_review_date: string;
  updated_at: string;
};

/**
 * isSynced: 0 のカードをSupabaseへバックグラウンドでupsertし、
 * 成功したカードのisSynced を 1 に更新する。
 *
 * - 環境変数が未設定なら即時returnしてクラッシュしない
 * - 並列呼び出しは2重実行しない（後発は即時return）
 * - 失敗してもローカルDBは変更せず、次回再試行できる
 */
export async function syncToSupabase(): Promise<void> {
  // 環境変数チェック（プレースホルダー値も弾く）
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || url.includes('your_') || !key || key.includes('your_')) return;

  if (running) return;
  running = true;

  try {
    const userId = await ensureSession();
    if (!userId) return;

    const cards = await getUnsyncedCards();
    if (cards.length === 0) return;

    const rows: SupabaseRow[] = cards
      .filter((c) => c.id != null)
      .map((card) => {
        const row: SupabaseRow = {
          user_id: userId,
          local_id: card.id!,
          front: card.front,
          back: card.back,
          category: card.category,
          image_url: card.imageUrl ?? null,
          repetitions: card.repetitions,
          ease_factor: card.easeFactor,
          interval: card.interval,
          next_review_date: card.nextReviewDate.toISOString(),
          updated_at: card.updatedAt.toISOString(),
        };
        if (card.remoteId) row.id = card.remoteId;
        return row;
      });

    // onConflict: 'user_id,local_id' により新規はINSERT、既存はUPDATE
    const { data, error } = await supabase
      .from('flashcards')
      .upsert(rows, { onConflict: 'user_id,local_id' })
      .select('id, local_id');

    if (error) throw error;

    // 同期成功したカードをローカルでマーク
    await db.transaction('rw', db.flashcards, async () => {
      for (const row of data ?? []) {
        await db.flashcards.update(row.local_id as number, {
          isSynced: 1 as 0 | 1,
          remoteId: row.id as string,
        });
      }
    });
  } catch (err) {
    console.error('[Sync] failed:', err);
    // isSynced は変更しない → 次回アプリ起動時に再試行
  } finally {
    running = false;
  }
}
