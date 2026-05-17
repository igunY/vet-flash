'use client';

import { useState, useEffect, useCallback } from 'react';
import { type Folder, getFolders, addFolder, deleteFolder, getFolderStats } from '@/lib/db';

export interface FolderWithStats extends Folder {
  cardCount: number;
  dueCount: number;
  correctCount: number;
}

interface UseFoldersReturn {
  folders: FolderWithStats[];
  loading: boolean;
  create: (name: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFolders(): UseFoldersReturn {
  const [folders, setFolders] = useState<FolderWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [raw, statsMap] = await Promise.all([getFolders(), getFolderStats()]);

    const withStats: FolderWithStats[] = raw.map((f) => {
      const id = f.id!;
      const s = statsMap.get(id) ?? { total: 0, correct: 0, due: 0 };
      return { ...f, cardCount: s.total, dueCount: s.due, correctCount: s.correct };
    });

    setFolders(withStats);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (name: string) => {
      await addFolder(name);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: number) => {
      await deleteFolder(id);
      await refresh();
    },
    [refresh],
  );

  return { folders, loading, create, remove, refresh };
}
