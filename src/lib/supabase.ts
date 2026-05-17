import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// 環境変数が未設定の場合は null（モジュール読み込み時にクラッシュしない）
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/**
 * 匿名セッションを確保してユーザーIDを返す。
 * 既存セッションがあればそのまま使用し、なければ匿名サインインを行う。
 * 環境変数が未設定の場合は null を返す（同期スキップ）。
 */
export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('[Supabase] anonymous sign-in failed:', error.message);
    return null;
  }
  return data.user?.id ?? null;
}
