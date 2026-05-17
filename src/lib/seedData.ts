import { addCard } from './db';

const SEED_CARDS = [
  {
    front: 'アトロピン硫酸塩の作用機序は？',
    back: 'ムスカリン受容体拮抗 → 副交感神経抑制',
    category: '薬理学',
  },
  {
    front: 'β-ラクタム系薬が猫ヘモプラズマに無効な理由は？',
    back: '細胞壁を持たないため作用標的がない',
    category: '微生物学',
  },
  {
    front: '有機リン剤中毒の解毒薬は？',
    back: 'アトロピン（コリンエステラーゼ阻害を拮抗）',
    category: '薬理学',
  },
  {
    front: '犬パルボウイルス腸炎の原因ウイルスは？',
    back: 'Canine Parvovirus Type 2 (CPV-2)',
    category: '微生物学',
  },
  {
    front: 'フルオレセインストリップで染色される眼疾患は？',
    back: '角膜潰瘍（フルオレセインが角膜実質に浸透）',
    category: '眼科学',
  },
  {
    front: 'Somogyi現象とは？',
    back: 'インスリン過剰→低血糖→拮抗ホルモン放出→リバウンド高血糖',
    category: '内科学',
  },
  {
    front: 'ネコ甲状腺機能亢進症の第一選択薬は？',
    back: 'メチマゾール（チアマゾール）',
    category: '薬理学',
  },
  {
    front: 'ネコのFIPはどのウイルスが変異したものか？',
    back: 'ネココロナウイルス（FCoV）が変異して腹膜炎を引き起こす',
    category: '微生物学',
  },
  {
    front: 'Cushing症候群（副腎皮質機能亢進症）の特徴的な外観は？',
    back: '腹部膨満・左右対称性脱毛・多飲多尿・皮膚菲薄化',
    category: '内科学',
  },
  {
    front: 'SM-2アルゴリズムでEFの初期値は？下限は？',
    back: '初期値 2.5 / 下限 1.3（下回らないようにクランプ）',
    category: '学習理論',
  },
];

export async function seedDatabase(): Promise<void> {
  for (const card of SEED_CARDS) {
    await addCard(card);
  }
}
