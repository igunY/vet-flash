import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `あなたは獣医学の専門教育者です。学生が国家試験に合格できるよう、正確で簡潔なフラッシュカードを作成します。

ルール:
- 表（問題）: 一問一答形式。明確で具体的な問い。
- 裏（解答）: 20〜40文字以内。暗記しやすい核心情報のみ。
- カテゴリ: 薬理学・微生物学・内科学・外科学・病理学・生理学・解剖学・眼科学・産科学・公衆衛生学 のいずれか（最適なものを選ぶ）。
- 1キーワードにつき3〜5枚の原子カード（最小単位）を生成する。
- 曖昧な表現・冗長な解答は禁止。数値・薬品名・病態機序を優先する。`;

type CardShape = { front: string; back: string; category: string };

function isValidCard(c: unknown): c is CardShape {
  return (
    c !== null &&
    typeof c === 'object' &&
    typeof (c as Record<string, unknown>).front === 'string' &&
    typeof (c as Record<string, unknown>).back === 'string' &&
    (c as Record<string, unknown>).front !== '' &&
    (c as Record<string, unknown>).back !== ''
  );
}

export async function POST(req: NextRequest) {
  const { keywords } = await req.json() as { keywords: string };

  if (!keywords?.trim()) {
    return NextResponse.json({ error: 'keywords is required' }, { status: 400 });
  }

  let cards: CardShape[] = [];

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `以下のキーワードからフラッシュカードを生成してください:\n${keywords.trim()}`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            cards: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  front: { type: 'string', description: '問題文' },
                  back: { type: 'string', description: '解答（40文字以内）' },
                  category: { type: 'string', description: '科目カテゴリ' },
                },
                required: ['front', 'back', 'category'],
              },
            },
          },
          required: ['cards'],
        },
      },
    });

    const text = result?.text;
    if (text) {
      const parsed: unknown = JSON.parse(text);
      const rawCards = Array.isArray((parsed as Record<string, unknown>)?.cards)
        ? ((parsed as Record<string, unknown>).cards as unknown[])
        : Array.isArray(parsed)
        ? (parsed as unknown[])
        : [];
      cards = rawCards
        .filter(isValidCard)
        .map((c) => ({
          front: c.front,
          back: c.back,
          category: typeof c.category === 'string' && c.category ? c.category : '未分類',
        }));
    }
  } catch (err) {
    console.error('[generate-cards]', err);
    return NextResponse.json({ error: 'カードの生成に失敗しました', cards: [] }, { status: 500 });
  }

  return NextResponse.json({ cards });
}
