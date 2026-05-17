-- ============================================================
-- 獣医フラッシュカードアプリ — Supabase マイグレーション
-- 実行方法: Supabase Dashboard > SQL Editor に貼り付けて実行
-- 事前準備: Dashboard > Authentication > Settings で
--           "Enable anonymous sign-ins" を ON にすること
-- ============================================================

-- UUID 拡張（デフォルトで有効だが念のため）
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────
-- flashcards テーブル
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flashcards (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ローカルDexieのID（同一ユーザー内で一意）
  local_id         integer     NOT NULL,

  -- カード本体
  front            text        NOT NULL,
  back             text        NOT NULL,
  category         text        NOT NULL DEFAULT '',
  image_url        text,

  -- SM-2 状態
  repetitions      integer     NOT NULL DEFAULT 0,
  ease_factor      real        NOT NULL DEFAULT 2.5,
  "interval"       integer     NOT NULL DEFAULT 1,

  -- スケジューリング
  next_review_date timestamptz NOT NULL,
  updated_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- 同一ユーザーの同一ローカルカードはupsertで1レコードに収束
  UNIQUE (user_id, local_id)
);

-- ────────────────────────────────────────────
-- インデックス
-- ────────────────────────────────────────────
-- 復習スケジュール取得用（将来のサーバー側スケジューリングに備えて）
CREATE INDEX IF NOT EXISTS flashcards_user_next_review
  ON public.flashcards (user_id, next_review_date);

-- ────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- 匿名ユーザーを含む全認証済みユーザーが自分のカードのみ操作可能
CREATE POLICY "users_manage_own_cards"
  ON public.flashcards
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
