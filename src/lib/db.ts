import Dexie, { type Table } from 'dexie';
import { calculateSM2, INITIAL_SM2_STATE, type SM2State } from './sm2';

// ---- 型定義 ----

export interface Folder {
  id?: number;
  name: string;
  createdAt: Date;
}

export interface FlashCard {
  id?: number;
  front: string;
  back: string;
  category: string;
  imageUrl?: string;
  folderId?: number;
  // SM-2 state
  repetitions: number;
  easeFactor: number;
  interval: number;
  // 累積NG回数（quality < 3 の回答回数）
  wrongCount: number;
  // Scheduling & metadata
  nextReviewDate: Date;
  updatedAt: Date;
  // 0 = 未同期, 1 = Supabase同期済み
  isSynced: 0 | 1;
  remoteId?: string;
}

// ---- DB定義 ----

class VetFlashDB extends Dexie {
  flashcards!: Table<FlashCard>;
  folders!: Table<Folder>;

  constructor() {
    super('VetFlashDB');
    this.version(1).stores({
      flashcards: '++id, nextReviewDate, isSynced',
    });
    this.version(2).stores({
      flashcards: '++id, nextReviewDate, isSynced, folderId',
      folders: '++id, name, createdAt',
    });
    // v3: wrongCount フィールド追加（非インデックス、既存レコードは 0 扱い）
    this.version(3).stores({
      flashcards: '++id, nextReviewDate, isSynced, folderId',
      folders: '++id, name, createdAt',
    });
  }
}

export const db = new VetFlashDB();

// ---- カード操作 ----

type NewCardInput = Omit<
  FlashCard,
  'id' | keyof SM2State | 'nextReviewDate' | 'updatedAt' | 'isSynced' | 'wrongCount'
>;

export async function addCard(input: NewCardInput): Promise<number> {
  const now = new Date();
  return db.flashcards.add({
    ...input,
    ...INITIAL_SM2_STATE,
    wrongCount: 0,
    nextReviewDate: now,
    updatedAt: now,
    isSynced: 0,
  });
}

/**
 * 期限が来たカードを最大 limit 枚取得する。
 * folderId を指定するとそのフォルダのカードのみ返す。
 */
export async function getDueCards(limit = 20, folderId?: number): Promise<FlashCard[]> {
  if (folderId !== undefined) {
    return db.flashcards
      .where('folderId')
      .equals(folderId)
      .filter((card) => card.nextReviewDate <= new Date())
      .limit(limit)
      .toArray();
  }
  return db.flashcards
    .where('nextReviewDate')
    .belowOrEqual(new Date())
    .limit(limit)
    .toArray();
}

export async function updateCardAfterReview(id: number, quality: number): Promise<void> {
  const card = await db.flashcards.get(id);
  if (!card) return;

  const nextState = calculateSM2(quality, {
    repetitions: card.repetitions,
    easeFactor: card.easeFactor,
    interval: card.interval,
  });

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + nextState.interval);

  const updates: Partial<FlashCard> = {
    ...nextState,
    nextReviewDate,
    updatedAt: new Date(),
    isSynced: 0,
  };

  if (quality < 3) {
    updates.wrongCount = (card.wrongCount ?? 0) + 1;
  }

  await db.flashcards.update(id, updates);
}

export async function getUnsyncedCards(): Promise<FlashCard[]> {
  return db.flashcards.where('isSynced').equals(0).toArray();
}

// ---- フォルダ操作 ----

export async function addFolder(name: string): Promise<number> {
  return db.folders.add({ name: name.trim(), createdAt: new Date() });
}

export async function getFolders(): Promise<Folder[]> {
  return db.folders.orderBy('createdAt').toArray();
}

export async function deleteFolder(id: number): Promise<void> {
  await db.transaction('rw', [db.folders, db.flashcards], async () => {
    await db.folders.delete(id);
    await db.flashcards
      .where('folderId')
      .equals(id)
      .modify((card) => { delete (card as Partial<FlashCard>).folderId; });
  });
}

/** フォルダごとのカード枚数を取得する（フォルダID → 枚数のMap） */
export async function getCardCountsByFolder(): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  const folders = await getFolders();
  await Promise.all(
    folders.map(async (f) => {
      if (f.id === undefined) return;
      const count = await db.flashcards.where('folderId').equals(f.id).count();
      map.set(f.id, count);
    }),
  );
  return map;
}

/** フォルダ内の学習期限が来たカードの枚数を取得する */
export async function getDueCountByFolder(folderId: number): Promise<number> {
  return db.flashcards
    .where('folderId')
    .equals(folderId)
    .filter((card) => card.nextReviewDate <= new Date())
    .count();
}

export async function getFolder(id: number): Promise<Folder | undefined> {
  return db.folders.get(id);
}

export async function getCardsByFolder(folderId: number): Promise<FlashCard[]> {
  return db.flashcards.where('folderId').equals(folderId).toArray();
}

export async function deleteCard(id: number): Promise<void> {
  await db.flashcards.delete(id);
}

/**
 * 全フォルダの統計（合計枚数・習得済み枚数・要復習枚数）を返す。
 */
export async function getFolderStats(): Promise<
  Map<number, { total: number; correct: number; due: number }>
> {
  const now = new Date();
  const folders = await getFolders();
  const map = new Map<number, { total: number; correct: number; due: number }>();

  await Promise.all(
    folders.map(async (f) => {
      if (f.id === undefined) return;
      const cards = await db.flashcards.where('folderId').equals(f.id).toArray();
      map.set(f.id, {
        total: cards.length,
        correct: cards.filter((c) => c.repetitions >= 1).length,
        due: cards.filter((c) => c.nextReviewDate <= now).length,
      });
    }),
  );

  return map;
}

// ---- クイズ設定型 ----

/** 出題順序 */
export type QuizOrder = 'asc' | 'desc' | 'random';

/**
 * クイズ用カードを取得する。
 * folderId が指定された場合は必ずそのフォルダのカードのみを対象とする（絶対条件）。
 * - order 'asc':    登録順昇順（id昇順）
 * - order 'desc':   登録順降順
 * - order 'random': Fischer-Yates シャッフル（デフォルト）
 * - minWrongCount:  この累積NG回数以上のカードのみ抽出（0 = フィルタなし）
 * - startCardId:    指定カードを1問目に移動
 */
export async function getCardsForQuiz({
  folderId,
  limit,
  order = 'random',
  minWrongCount = 0,
  startCardId,
}: {
  folderId?: number;
  limit?: number;
  order?: QuizOrder;
  minWrongCount?: number;
  startCardId?: number;
}): Promise<FlashCard[]> {
  let cards: FlashCard[];

  if (folderId !== undefined) {
    cards = await db.flashcards.where('folderId').equals(folderId).toArray();
  } else {
    cards = await db.flashcards.toArray();
  }

  // wrongCount フィルタ（既存カードの wrongCount が undefined の場合は 0 扱い）
  if (minWrongCount > 0) {
    cards = cards.filter((c) => (c.wrongCount ?? 0) >= minWrongCount);
  }

  // 並び替え
  if (order === 'asc') {
    cards = [...cards].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  } else if (order === 'desc') {
    cards = [...cards].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  } else {
    // random: Fischer-Yates
    cards = [...cards];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }

  // 開始位置: startCardId を先頭へ移動
  if (startCardId !== undefined) {
    const idx = cards.findIndex((c) => c.id === startCardId);
    if (idx > 0) {
      cards = [...cards.slice(idx), ...cards.slice(0, idx)];
    }
  }

  if (limit && limit > 0) cards = cards.slice(0, limit);
  return cards;
}

/** 指定カードの wrongCount を 0 にリセットする */
export async function resetWrongCount(ids: number[]): Promise<void> {
  await Promise.all(ids.map((id) => db.flashcards.update(id, { wrongCount: 0 })));
}

/** フォルダに属していない孤立カードを削除し、削除件数を返す */
export async function cleanupOrphanedCards(): Promise<number> {
  const folderIds = new Set((await getFolders()).map((f) => f.id!));
  const orphans = await db.flashcards
    .filter((card) => card.folderId === undefined || !folderIds.has(card.folderId))
    .toArray();
  if (orphans.length > 0) {
    await db.flashcards.bulkDelete(orphans.map((c) => c.id!));
  }
  return orphans.length;
}

/** カードを一括保存する（SM-2初期値を付与）。ファイルインポート等で使用。 */
export async function bulkAddCards(inputs: NewCardInput[]): Promise<void> {
  const now = new Date();
  const records = inputs.map((input) => ({
    ...input,
    ...INITIAL_SM2_STATE,
    wrongCount: 0,
    nextReviewDate: now,
    updatedAt: now,
    isSynced: 0 as const,
  }));
  await db.flashcards.bulkAdd(records);
}
