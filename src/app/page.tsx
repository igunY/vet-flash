'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useFolders, type FolderWithStats } from '@/hooks/useFolders';

// ---- フォルダ作成モーダル ----
function CreateFolderModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5 shadow-2xl">
        <div>
          <h2 className="text-base font-bold text-white">新しい問題集を作成</h2>
          <p className="text-xs text-gray-500 mt-0.5">科目や試験範囲ごとにまとめよう</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 薬理学まとめ、外科系総復習..."
            maxLength={40}
            className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-600 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '作成中...' : '作成する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- フォルダカード ----
function FolderCard({ folder, onDelete }: { folder: FolderWithStats; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="relative group">
      <Link
        href={`/folders/${folder.id}`}
        className="block bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 hover:border-emerald-600/50 hover:bg-gray-800/90 transition-all active:scale-[0.97]"
      >
        <div className="w-9 h-9 rounded-lg bg-emerald-900/40 border border-emerald-800/40 flex items-center justify-center mb-3">
          <svg className="w-[18px] h-[18px] text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-white truncate leading-snug">{folder.name}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-[11px] text-gray-500 tabular-nums">{folder.cardCount} 枚</span>
        </div>
      </Link>

      {/* 削除ボタン */}
      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all"
          aria-label="削除"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      ) : (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-gray-900 border border-red-800/50 rounded-lg px-1.5 py-1 shadow-lg">
          <span className="text-[10px] text-red-400">削除?</span>
          <button onClick={onDelete} className="text-[10px] font-bold text-red-400 hover:text-red-300 px-1">はい</button>
          <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-gray-500 hover:text-gray-300 px-1">いいえ</button>
        </div>
      )}
    </div>
  );
}

// ---- Home 画面 ----
export default function HomePage() {
  const { folders, loading: foldersLoading, create, remove } = useFolders();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const totalCards = folders.reduce((sum, f) => sum + f.cardCount, 0);

  return (
    <main className="min-h-screen bg-gray-900 flex flex-col">
      {/* ヘッダー */}
      <header className="px-6 py-5 border-b border-gray-800/80 flex items-center justify-between pt-safe">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">VetFlash</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>{foldersLoading ? '...' : `${totalCards} 枚`}</span>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center px-6 py-8 gap-6">

          {/* 問題集一覧 */}
          <section className="w-full max-w-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">マイ問題集</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                新しい問題集
              </button>
            </div>

            {foldersLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {[0, 1].map((i) => (
                  <div key={i} className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-4 h-24 animate-pulse" />
                ))}
              </div>
            ) : folders.length === 0 ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full border-2 border-dashed border-gray-700/60 rounded-xl py-12 flex flex-col items-center gap-3 text-gray-600 hover:border-emerald-700/50 hover:text-emerald-600 transition-colors"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm">最初の問題集を作成する</span>
                <span className="text-xs text-gray-700">問題集を選んで学習をスタート</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {folders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onDelete={() => remove(folder.id!)}
                  />
                ))}
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="border-2 border-dashed border-gray-700/50 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 text-gray-600 hover:border-emerald-700/40 hover:text-emerald-600 transition-colors min-h-[5.5rem]"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-[11px]">追加</span>
                </button>
              </div>
            )}
          </section>

          <p className="text-[11px] text-gray-700 pb-2">獣医学国家試験対策 · VetFlash</p>
          <div className="pb-safe" />
        </div>
      </div>

      {/* モーダル */}
      {showCreateModal && (
        <CreateFolderModal
          onClose={() => setShowCreateModal(false)}
          onCreate={create}
        />
      )}
    </main>
  );
}
