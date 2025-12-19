// VRM表情の型定義

// アニメーションタイプ
export const VRM_ANIMATIONS = {
  idle: "idle",           // 通常待機
  lookAround: "lookAround", // 周りを見回す
  sleepy: "sleepy",       // 眠たげ
  thinking: "thinking",   // 考え中
  nod: "nod",             // うなずく
} as const;

export type VRMAnimation = keyof typeof VRM_ANIMATIONS;

export const ANIMATION_LABELS: Record<VRMAnimation, string> = {
  idle: "通常",
  lookAround: "きょろきょろ",
  sleepy: "眠たげ",
  thinking: "考え中",
  nod: "うなずき",
};

export const VRM_EXPRESSIONS = {
  neutral: "neutral",
  happy: "happy",
  angry: "angry",
  sad: "sad",
  relaxed: "relaxed",
  surprised: "surprised",
} as const;

export type VRMExpression = keyof typeof VRM_EXPRESSIONS;

export const EXPRESSION_LABELS: Record<VRMExpression, string> = {
  neutral: "普通",
  happy: "喜び",
  angry: "怒り",
  sad: "悲しみ",
  relaxed: "リラックス",
  surprised: "驚き",
};

// 表情ごとのVRM expressionManager設定
export const EXPRESSION_CONFIGS: Record<VRMExpression, Record<string, number>> = {
  neutral: {},
  happy: { happy: 1.0 },
  angry: { angry: 1.0 },
  sad: { sad: 1.0 },
  relaxed: { relaxed: 1.0 },
  surprised: { surprised: 1.0 },
};

// AIの応答テキストから表情を判定するためのキーワード
export const EXPRESSION_KEYWORDS: Record<VRMExpression, string[]> = {
  happy: [
    "嬉しい", "楽しい", "やった", "すごい", "素晴らしい", "いいね",
    "最高", "わーい", "やったね", "おめでとう", "良かった", "幸せ",
    "ありがとう", "感謝", "！", "♪", "わくわく", "面白い"
  ],
  angry: [
    "怒", "ムカつく", "許せない", "イライラ", "腹が立つ",
    "ひどい", "最悪", "ダメ"
  ],
  sad: [
    "悲しい", "残念", "つらい", "寂しい", "泣", "ごめん",
    "申し訳", "心配", "不安", "大変"
  ],
  surprised: [
    "驚", "びっくり", "えっ", "まさか", "本当", "信じられない",
    "すごい", "なんと", "！？", "？！", "えー"
  ],
  relaxed: [
    "ゆっくり", "のんびり", "落ち着", "リラックス", "穏やか",
    "静か", "平和", "安心"
  ],
  neutral: [],
};

/**
 * テキストから表情を判定する
 * @param text 分析するテキスト
 * @returns 判定された表情
 */
export function detectExpressionFromText(text: string): VRMExpression {
  const scores: Record<VRMExpression, number> = {
    neutral: 0,
    happy: 0,
    angry: 0,
    sad: 0,
    relaxed: 0,
    surprised: 0,
  };

  // 各表情のキーワードをカウント
  for (const [expression, keywords] of Object.entries(EXPRESSION_KEYWORDS)) {
    for (const keyword of keywords) {
      const matches = text.match(new RegExp(keyword, "gi"));
      if (matches) {
        scores[expression as VRMExpression] += matches.length;
      }
    }
  }

  // 最もスコアの高い表情を返す（0の場合はneutral）
  let maxScore = 0;
  let maxExpression: VRMExpression = "neutral";

  for (const [expression, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxExpression = expression as VRMExpression;
    }
  }

  // happyとsurprisedのスコアが同じ場合はhappyを優先（ポジティブな表現が多いため）
  if (scores.happy > 0 && scores.happy === scores.surprised) {
    return "happy";
  }

  return maxExpression;
}
