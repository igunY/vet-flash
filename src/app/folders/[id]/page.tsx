'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type Folder,
  type FlashCard,
  type QuizOrder,
  getFolder,
  getCardsByFolder,
  addCard,
  deleteCard,
  bulkAddCards,
  resetWrongCount,
} from '@/lib/db';

// ---- 定数 ----

const CATEGORIES = [
  '薬理学', '微生物学', '内科学', '外科学', '病理学',
  '生理学', '解剖学', '眼科学', '産科学', '公衆衛生学',
] as const;

type PageMode = 'study' | 'manage';
type ContentTab = 'manual' | 'ai' | 'import';
type GeneratedCard = { id: string; front: string; back: string; category: string };
type DragState = 'idle' | 'hovering' | 'processing' | 'done' | 'error';

const ACCEPTED_EXTS = ['.csv', '.txt', '.tsv'];

const LIMIT_OPTIONS: { label: string; value: number }[] = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '全て', value: 0 },
];

// ---- ファイルパーサー ----

type ParsedCard = { front: string; back: string; category: string };

function parseFileContent(content: string, ext: string): ParsedCard[] {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.some((l) => /^[Qq][：:]/.test(l))) {
    const results: ParsedCard[] = [];
    let currentQ: string | null = null;
    for (const line of lines) {
      const qMatch = line.match(/^[Qq][：:]\s*(.+)/);
      const aMatch = line.match(/^[Aa][：:]\s*(.+)/);
      if (qMatch) { currentQ = qMatch[1].trim(); }
      else if (aMatch && currentQ !== null) {
        results.push({ front: currentQ, back: aMatch[1].trim(), category: '未分類' });
        currentQ = null;
      }
    }
    return results;
  }

  const delim = ext === '.tsv' ? '\t' : ',';
  return lines
    .filter((l) => !l.startsWith('#') && !l.startsWith('//'))
    .flatMap((l) => {
      const parts =
        ext === '.txt'
          ? l.includes('\t') ? l.split('\t') : l.split(',')
          : l.split(delim);
      if (parts.length < 2) return [];
      const [rawFront, rawBack, rawCategory] = parts.map((p) =>
        p.trim().replace(/^["'`]|["'`]$/g, ''),
      );
      if (!rawFront || !rawBack) return [];
      return [{ front: rawFront, back: rawBack, category: rawCategory?.trim() || '未分類' }];
    });
}

// ============================================================
// 出題設定セクション（出題・一覧モード）
// ============================================================
function QuizSettingsSection({
  cards,
  order,
  setOrder,
  limit,
  setLimit,
  minWrongCount,
  setMinWrongCount,
  onStart,
}: {
  cards: FlashCard[];
  order: QuizOrder;
  setOrder: (v: QuizOrder) => void;
  limit: number;
  setLimit: (v: number) => void;
  minWrongCount: number;
  setMinWrongCount: (v: number) => void;
  onStart: () => void;
}) {
  const filteredCount =
    minWrongCount > 0
      ? cards.filter((c) => (c.wrongCount ?? 0) >= minWrongCount).length
      : cards.length;
  const effectiveCount = limit > 0 ? Math.min(limit, filteredCount) : filteredCount;

  return (
    <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 flex flex-col gap-4">
      {/* 出題順 */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-500">出題順</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { label: '登録順↑', value: 'asc' as QuizOrder },
              { label: '登録順↓', value: 'desc' as QuizOrder },
              { label: 'ランダム', value: 'random' as QuizOrder },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setOrder(opt.value)}
              className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                order === opt.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-700/60 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 出題数 */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-500">出題数</p>
        <div className="grid grid-cols-5 gap-1.5">
          {LIMIT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLimit(opt.value)}
              className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                limit === opt.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-700/60 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* NG条件 */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-500">履歴条件</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 whitespace-nowrap">N回以上NGのみ</span>
          <input
            type="number"
            min={0}
            max={99}
            value={minWrongCount}
            onChange={(e) => setMinWrongCount(Math.max(0, Number(e.target.value)))}
            className="w-14 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <span className="text-xs text-gray-500">回</span>
          {minWrongCount > 0 && (
            <>
              <span className="text-xs text-amber-400 tabular-nums">→ {filteredCount} 枚対象</span>
              <button
                onClick={() => setMinWrongCount(0)}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                クリア
              </button>
            </>
          )}
        </div>
      </div>

      {/* 開始ボタン */}
      <button
        onClick={onStart}
        disabled={cards.length === 0 || filteredCount === 0}
        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {effectiveCount > 0 ? `⚡ ${effectiveCount}問で学習開始` : '⚡ この条件で学習開始'}
      </button>
      {filteredCount === 0 && minWrongCount > 0 && (
        <p className="text-xs text-gray-500 text-center -mt-2">
          NG {minWrongCount}回以上のカードがありません
        </p>
      )}
    </div>
  );
}

// ============================================================
// カードリストセクション（出題・一覧モード）
// ============================================================
function CardListSection({
  cards,
  onStartFromCard,
  onBulkDelete,
  onBulkResetNg,
}: {
  cards: FlashCard[];
  onStartFromCard: (id: number) => void;
  onBulkDelete: (ids: number[]) => Promise<void>;
  onBulkResetNg: (ids: number[]) => Promise<void>;
}) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState(false);

  const sortedCards = [...cards].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  const allSelected = sortedCards.length > 0 && sortedCards.every((c) => selected.has(c.id!));

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelected(new Set());
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0 || processing) return;
    setProcessing(true);
    await onBulkDelete([...selected]);
    setSelected(new Set());
    setProcessing(false);
  };

  const handleBulkResetNg = async () => {
    if (selected.size === 0 || processing) return;
    setProcessing(true);
    await onBulkResetNg([...selected]);
    setSelected(new Set());
    setProcessing(false);
  };

  if (sortedCards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-gray-600">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-sm">まだカードがありません</p>
        <p className="text-xs">「コンテンツ管理」タブからカードを追加してください</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 選択モード切替バー */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[10px] text-gray-600">
          {selectionMode ? 'タップして選択' : 'タップすると1問目にして学習開始'}
        </p>
        <button
          onClick={() => selectionMode ? exitSelection() : setSelectionMode(true)}
          className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-700/50"
        >
          {selectionMode ? '完了' : '選択'}
        </button>
      </div>

      {/* 選択時アクションバー */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2"
          >
            <button
              onClick={() =>
                allSelected
                  ? setSelected(new Set())
                  : setSelected(new Set(sortedCards.map((c) => c.id!)))
              }
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors whitespace-nowrap"
            >
              {allSelected ? '全て解除' : '全て選択'}
            </button>
            <span className="text-xs text-gray-500 flex-1 text-center tabular-nums">
              {selected.size > 0 ? `${selected.size} 件選択中` : ''}
            </span>
            <button
              onClick={handleBulkResetNg}
              disabled={selected.size === 0 || processing}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-900/40 border border-amber-700/40 text-amber-400 hover:bg-amber-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              NGリセット
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={selected.size === 0 || processing}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-red-900/40 border border-red-700/40 text-red-400 hover:bg-red-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              削除
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* カード一覧 */}
      <AnimatePresence mode="popLayout">
        {sortedCards.map((card, idx) => (
          <motion.div
            key={card.id}
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
            className={`bg-gray-800 border rounded-xl overflow-hidden transition-colors ${
              selectionMode && selected.has(card.id!)
                ? 'border-emerald-600/50 bg-emerald-900/10'
                : 'border-gray-700/60'
            }`}
          >
            <button
              onClick={() =>
                selectionMode ? toggleSelect(card.id!) : onStartFromCard(card.id!)
              }
              className="w-full p-3 flex items-start gap-3 text-left hover:bg-gray-700/30 transition-colors"
            >
              {/* チェックボックス or 番号 */}
              {selectionMode ? (
                <div
                  className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                    selected.has(card.id!)
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-gray-500'
                  }`}
                >
                  {selected.has(card.id!) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              ) : (
                <span className="text-[11px] font-bold text-gray-600 tabular-nums w-5 flex-shrink-0 mt-0.5">
                  {idx + 1}
                </span>
              )}

              {/* カード内容 */}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold text-emerald-400">{card.category}</span>
                  {(card.wrongCount ?? 0) > 0 && (
                    <span className="text-[10px] text-red-400 tabular-nums">
                      NG×{card.wrongCount}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white leading-snug">{card.front}</p>
                <p className="text-xs text-gray-500 leading-snug line-clamp-1">{card.back}</p>
              </div>

              {/* 再生アイコン（通常モードのみ）*/}
              {!selectionMode && (
                <div className="flex-shrink-0 flex items-center self-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// コンテンツ管理 → 手動追加タブ
// ============================================================
function ManualTab({ folderId, onSaved }: { folderId: number; onSaved: () => void }) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const resolvedCategory = customCategory.trim() || category;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    setStatus('saving');
    try {
      await addCard({ front: front.trim(), back: back.trim(), category: resolvedCategory, folderId });
      setStatus('saved');
      setFront('');
      setBack('');
      onSaved();
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">科目カテゴリ</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => { setCategory(cat); setCustomCategory(''); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                category === cat && !customCategory
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="その他（自由入力）"
          value={customCategory}
          onChange={(e) => setCustomCategory(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">表（問題）</label>
        <textarea
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="例: アトロピン硫酸塩の作用機序は？"
          rows={3}
          required
          autoFocus
          className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-end justify-between">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">裏（解答）</label>
          <span className={`text-[10px] tabular-nums ${back.length > 40 ? 'text-amber-400' : 'text-gray-600'}`}>
            {back.length} / 40文字目安
          </span>
        </div>
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="例: ムスカリン受容体拮抗 → 副交感神経抑制"
          rows={3}
          required
          className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <p className="text-[10px] text-gray-600">1.5秒で読める量（20〜40文字）を目安に</p>
      </div>

      {(front || back) && (
        <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">プレビュー</p>
          <div className="flex flex-col gap-2">
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
              <p className="text-[10px] text-emerald-400 font-semibold mb-1">{resolvedCategory}</p>
              <p className="text-sm text-white">{front || '（表面）'}</p>
            </div>
            <div className="bg-emerald-950 border border-emerald-800 rounded-lg px-3 py-2">
              <p className="text-sm text-gray-200">{back || '（裏面）'}</p>
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!front.trim() || !back.trim() || status === 'saving'}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:cursor-not-allowed ${
          status === 'saved' ? 'bg-emerald-600 text-white'
            : status === 'error' ? 'bg-red-700 text-white'
            : 'bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40'
        }`}
      >
        {status === 'saving' ? '保存中...'
          : status === 'saved' ? '追加しました!'
          : status === 'error' ? 'エラーが発生しました'
          : 'カードを追加する'}
      </button>
    </form>
  );
}

// ============================================================
// コンテンツ管理 → AI自動生成タブ
// ============================================================
function AiTab({ folderId, onSaved }: { folderId: number; onSaved: () => void }) {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const generate = async () => {
    if (!keyword.trim()) return;
    setStatus('loading');
    setCards([]);
    setRemoved(new Set());
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/generate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keyword }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { cards?: unknown[] };
      const rawCards = Array.isArray(data?.cards) ? data.cards : [];
      const withIds: GeneratedCard[] = rawCards
        .filter(
          (c): c is { front: string; back: string; category?: string } =>
            c !== null &&
            typeof c === 'object' &&
            typeof (c as Record<string, unknown>).front === 'string' &&
            typeof (c as Record<string, unknown>).back === 'string',
        )
        .map((c, i) => ({
          id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          front: c.front,
          back: c.back,
          category: typeof c.category === 'string' && c.category ? c.category : '未分類',
        }));
      setCards(withIds);
      setStatus(withIds.length > 0 ? 'done' : 'error');
      if (withIds.length === 0) setErrorMsg('有効なカードが生成されませんでした。再度お試しください。');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '生成に失敗しました');
      setStatus('error');
    }
  };

  const saveAll = async () => {
    const toSave = cards.filter((c) => !removed.has(c.id));
    if (toSave.length === 0) return;
    setSaveStatus('saving');
    for (const c of toSave) {
      await addCard({ front: c.front, back: c.back, category: c.category, folderId });
    }
    setSaveStatus('saved');
    onSaved();
    setTimeout(() => {
      setCards([]);
      setRemoved(new Set());
      setStatus('idle');
      setSaveStatus('idle');
      setKeyword('');
    }, 1800);
  };

  const visibleCards = cards.filter((c) => !removed.has(c.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          キーワード・トピック
        </label>
        <textarea
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={'例: 犬のフィラリア症\n例: 牛の第4胃変位\n例: 猫の下部尿路疾患'}
          rows={5}
          disabled={status === 'loading'}
          className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
        />
        <p className="text-[10px] text-gray-600">
          1行1キーワードで複数入力可。Gemini が1問1答カードに自動変換します。
        </p>
      </div>

      <button
        onClick={generate}
        disabled={!keyword.trim() || status === 'loading'}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-700 hover:bg-indigo-600 text-white flex items-center justify-center gap-2"
      >
        {status === 'loading' ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            生成中...
          </>
        ) : 'AI でカードを生成する'}
      </button>

      {status === 'error' && (
        <p className="text-xs text-red-400 text-center">{errorMsg}</p>
      )}

      <AnimatePresence mode="popLayout">
        {status === 'done' && cards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3"
          >
            <p className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
              生成されたカード（{visibleCards.length}枚）
            </p>
            <AnimatePresence mode="popLayout">
              {cards.filter((c) => !removed.has(c.id)).map((card) => (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                  className="bg-gray-800 border border-gray-700/60 rounded-xl p-3 flex flex-col gap-1.5 relative"
                >
                  <button
                    onClick={() => setRemoved((prev) => new Set([...prev, card.id]))}
                    className="absolute top-2 right-2 text-gray-600 hover:text-red-400 transition-colors"
                    aria-label="削除"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <p className="text-[10px] font-semibold text-emerald-400 pr-6">{card.category}</p>
                  <p className="text-sm text-white pr-6">{card.front}</p>
                  <div className="h-px bg-gray-700 my-0.5" />
                  <p className="text-sm text-gray-300">{card.back}</p>
                </motion.div>
              ))}
            </AnimatePresence>
            {visibleCards.length > 0 && (
              <button
                onClick={saveAll}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                  saveStatus === 'saved'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50'
                }`}
              >
                {saveStatus === 'saving' ? '保存中...'
                  : saveStatus === 'saved' ? `${visibleCards.length}枚を保存しました!`
                  : `${visibleCards.length}枚をすべて保存する`}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// コンテンツ管理 → ファイルインポートタブ
// ============================================================
function ImportTab({ folderId, onSaved }: { folderId: number; onSaved: () => void }) {
  const [dragState, setDragState] = useState<DragState>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [importCount, setImportCount] = useState(0);
  const [inputKey, setInputKey] = useState(0);

  const reset = () => {
    setDragState('idle');
    setFileName(null);
    setErrorMsg('');
    setImportCount(0);
    setInputKey((k) => k + 1);
  };

  const processFile = (file: File) => {
    const ext = ('.' + (file.name.split('.').pop()?.toLowerCase() ?? ''));
    if (!ACCEPTED_EXTS.includes(ext)) {
      setErrorMsg(`未対応の形式です（対応: ${ACCEPTED_EXTS.join(', ')}）`);
      setDragState('error');
      return;
    }
    setFileName(file.name);
    setDragState('processing');
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string | null;
      if (!content) { setErrorMsg('ファイルの読み込みに失敗しました'); setDragState('error'); return; }
      const parsed = parseFileContent(content, ext);
      if (parsed.length === 0) {
        setErrorMsg('有効なカードが見つかりませんでした。フォーマットを確認してください。');
        setDragState('error');
        return;
      }
      try {
        await bulkAddCards(parsed.map((c) => ({ ...c, folderId })));
        setImportCount(parsed.length);
        setDragState('done');
        onSaved();
      } catch {
        setErrorMsg('保存中にエラーが発生しました');
        setDragState('error');
      }
    };
    reader.onerror = () => { setErrorMsg('ファイルの読み込みに失敗しました'); setDragState('error'); };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="flex flex-col gap-6">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragState('hovering'); }}
        onDragLeave={() => { if (dragState === 'hovering') setDragState('idle'); }}
        onDrop={(e) => { e.preventDefault(); setDragState('idle'); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all ${
          dragState === 'hovering' ? 'border-amber-500 bg-amber-950/30 scale-[1.01]'
            : dragState === 'done' ? 'border-emerald-600 bg-emerald-950/20 cursor-default'
            : dragState === 'error' ? 'border-red-700 bg-red-950/20 cursor-default'
            : dragState === 'processing' ? 'border-amber-600/50 bg-amber-950/10 cursor-default'
            : 'border-gray-700 bg-gray-800/30 hover:border-amber-700/60 hover:bg-amber-950/10'
        }`}
      >
        {(dragState === 'idle' || dragState === 'hovering') && (
          <input key={inputKey} type="file" accept={ACCEPTED_EXTS.join(',')}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        )}
        {dragState === 'processing' && (
          <>
            <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <p className="text-sm text-amber-400 font-medium">読み込み・保存中...</p>
          </>
        )}
        {dragState === 'done' && (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-900/50 border border-emerald-700 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white">{importCount} 枚のカードをインポートしました！</p>
              <p className="text-xs text-emerald-400 mt-1">{fileName}</p>
            </div>
          </>
        )}
        {dragState === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-950/50 border border-red-800 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-xs text-red-400 text-center">{errorMsg}</p>
          </>
        )}
        {(dragState === 'idle' || dragState === 'hovering') && (
          <>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${dragState === 'hovering' ? 'bg-amber-800/40' : 'bg-gray-800'}`}>
              <svg className={`w-7 h-7 transition-colors ${dragState === 'hovering' ? 'text-amber-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-300">ここにファイルをドロップ</p>
              <p className="text-xs text-gray-600 mt-1">または クリックして選択</p>
            </div>
            <p className="text-[11px] text-gray-600">対応形式: CSV · TXT · TSV</p>
          </>
        )}
      </label>

      {(dragState === 'done' || dragState === 'error') && (
        <button onClick={reset} className="w-full py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
          別のファイルを選ぶ
        </button>
      )}

      <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4 flex flex-col gap-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">対応フォーマット</p>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-300 mb-1">CSV / TSV（区切り文字）</p>
            <code className="text-[11px] text-emerald-400 bg-gray-900 rounded px-2 py-1 block font-mono">問題文,解答,カテゴリ名（省略可）</code>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-300 mb-1">テキスト（Q&A 形式）</p>
            <code className="text-[11px] text-emerald-400 bg-gray-900 rounded px-2 py-1.5 block font-mono whitespace-pre leading-5">{`Q: 問題文\nA: 解答`}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// メインページ
// ============================================================
export default function FolderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const folderId = Number(params.id);

  const [folder, setFolder] = useState<Folder | null>(null);
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ページモード
  const [pageMode, setPageMode] = useState<PageMode>('study');
  const [contentTab, setContentTab] = useState<ContentTab>('manual');

  // 出題設定（出題・一覧モードで共有）
  const [quizOrder, setQuizOrder] = useState<QuizOrder>('random');
  const [quizLimit, setQuizLimit] = useState<number>(10);
  const [quizMinWrongCount, setQuizMinWrongCount] = useState<number>(0);

  const refresh = useCallback(async () => {
    const [f, c] = await Promise.all([getFolder(folderId), getCardsByFolder(folderId)]);
    if (!f) { setNotFound(true); setLoading(false); return; }
    setFolder(f);
    setCards(c);
    setLoading(false);
  }, [folderId]);

  useEffect(() => { refresh(); }, [refresh]);

  const buildQuizUrl = useCallback(
    (startCardId?: number) => {
      const p = new URLSearchParams({ folderId: String(folderId), order: quizOrder });
      if (quizLimit > 0) p.set('limit', String(quizLimit));
      if (quizMinWrongCount > 0) p.set('minWrongCount', String(quizMinWrongCount));
      if (startCardId !== undefined) p.set('startCardId', String(startCardId));
      return `/quiz?${p}`;
    },
    [folderId, quizOrder, quizLimit, quizMinWrongCount],
  );

  const handleBulkDelete = useCallback(async (ids: number[]) => {
    await Promise.all(ids.map((id) => deleteCard(id)));
    setCards((prev) => prev.filter((c) => !ids.includes(c.id!)));
  }, []);

  const handleBulkResetNg = useCallback(async (ids: number[]) => {
    await resetWrongCount(ids);
    setCards((prev) => prev.map((c) => ids.includes(c.id!) ? { ...c, wrongCount: 0 } : c));
  }, []);

  const CONTENT_TABS: { id: ContentTab; label: string }[] = [
    { id: 'manual', label: '手動追加' },
    { id: 'ai', label: 'AI生成' },
    { id: 'import', label: 'ファイル' },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-gray-400 text-sm">問題集が見つかりませんでした</p>
        <Link href="/" className="text-emerald-400 text-sm hover:underline">ホームへ戻る</Link>
      </main>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      {/* ヘッダー + モード切替（ノッチ対応で一括sticky）*/}
      <div className="sticky top-0 z-10">
        <header className="flex items-center gap-3 px-4 py-4 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm pt-safe">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            ホーム
          </Link>
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-sm font-bold text-white truncate">{folder?.name}</h1>
            <p className="text-[11px] text-gray-500">{cards.length} 枚</p>
          </div>
          <div className="w-14 flex-shrink-0" />
        </header>

        {/* ページモード切替タブ */}
        <div className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex">
          {(
            [
              { mode: 'study' as PageMode, label: '出題・一覧' },
              { mode: 'manage' as PageMode, label: 'コンテンツ管理' },
            ] as const
          ).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setPageMode(mode)}
              className={`relative flex-1 py-3 text-sm font-medium transition-colors ${
                pageMode === mode ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
              {pageMode === mode && (
                <motion.div
                  layoutId="page-mode-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"
                />
              )}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* コンテンツエリア */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {pageMode === 'study' ? (
            <motion.div
              key="study"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-6"
            >
              {/* 出題設定 */}
              <section className="flex flex-col gap-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  出題設定
                </p>
                <QuizSettingsSection
                  cards={cards}
                  order={quizOrder}
                  setOrder={setQuizOrder}
                  limit={quizLimit}
                  setLimit={setQuizLimit}
                  minWrongCount={quizMinWrongCount}
                  setMinWrongCount={setQuizMinWrongCount}
                  onStart={() => router.push(buildQuizUrl())}
                />
              </section>

              {/* カード一覧 */}
              <section className="flex flex-col gap-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  単語リスト（{cards.length} 枚）
                </p>
                <CardListSection
                  cards={cards}
                  onStartFromCard={(id) => router.push(buildQuizUrl(id))}
                  onBulkDelete={handleBulkDelete}
                  onBulkResetNg={handleBulkResetNg}
                />
              </section>
              <div className="pb-safe" />
            </motion.div>
          ) : (
            <motion.div
              key="manage"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="max-w-lg mx-auto flex flex-col"
            >
              {/* コンテンツ管理タブバー */}
              <div className="relative flex border-b border-gray-800 px-4">
                {CONTENT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setContentTab(tab.id)}
                    className={`relative flex-1 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                      contentTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                    {tab.id === 'ai' && (
                      <span className="text-[8px] font-bold bg-indigo-800/60 text-indigo-300 px-1 py-0.5 rounded-full">AI</span>
                    )}
                    {contentTab === tab.id && (
                      <motion.div
                        layoutId="content-tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* タブコンテンツ */}
              <div className="px-4 py-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={contentTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                  >
                    {contentTab === 'manual' && <ManualTab folderId={folderId} onSaved={refresh} />}
                    {contentTab === 'ai' && <AiTab folderId={folderId} onSaved={refresh} />}
                    {contentTab === 'import' && <ImportTab folderId={folderId} onSaved={refresh} />}
                  </motion.div>
                </AnimatePresence>
                <div className="pb-safe" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
