'use client';

import { useState, useCallback, useEffect } from 'react';
import { db } from '@/lib/db';
import { syncToSupabase } from '@/lib/sync';

export type SyncStatus = {
  pending: number;   // 未同期カード枚数
  syncing: boolean;  // 同期中フラグ
  sync: () => Promise<void>; // 手動トリガー
};

export function useSyncStatus(): SyncStatus {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPending = useCallback(async () => {
    const count = await db.flashcards.where('isSynced').equals(0).count();
    setPending(count);
  }, []);

  // マウント時に未同期カード数を確認
  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncToSupabase();
    } finally {
      setSyncing(false);
      await refreshPending();
    }
  }, [refreshPending]);

  return { pending, syncing, sync };
}
