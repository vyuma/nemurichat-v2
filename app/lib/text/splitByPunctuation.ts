/**
 * テキストを句読点で分割するユーティリティ
 * TTS音声を句読点単位で取得・再生するために使用
 */

// 分割対象の句読点
const PUNCTUATION_PATTERN = /([。、！？!?]+)/;

/**
 * テキストを句読点で分割する
 * @param text 分割するテキスト
 * @returns 句読点を含むチャンクの配列
 * @example
 * splitByPunctuation("こんにちは。今日は良い天気ですね！")
 * // => ["こんにちは。", "今日は良い天気ですね！"]
 */
export function splitByPunctuation(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // 句読点で分割（句読点も保持）
  const parts = text.split(PUNCTUATION_PATTERN);
  const chunks: string[] = [];
  let current = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    // 句読点かどうかをチェック
    if (PUNCTUATION_PATTERN.test(part)) {
      // 句読点を現在のチャンクに追加
      current += part;
      if (current.trim().length > 0) {
        chunks.push(current);
        current = "";
      }
    } else {
      current += part;
    }
  }

  // 残りのテキストがあれば追加
  if (current.trim().length > 0) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * 短すぎるチャンクを次のチャンクと結合する
 * @param text 分割するテキスト
 * @param minLength 最小チャンク長（デフォルト: 5文字）
 * @returns 最小長を満たすチャンクの配列
 */
export function splitByPunctuationWithMinLength(
  text: string,
  minLength: number = 5
): string[] {
  const chunks = splitByPunctuation(text);
  if (chunks.length <= 1) {
    return chunks;
  }

  const result: string[] = [];
  let buffer = "";

  for (const chunk of chunks) {
    buffer += chunk;
    if (buffer.length >= minLength) {
      result.push(buffer);
      buffer = "";
    }
  }

  // 残りのバッファがあれば最後のチャンクに追加
  if (buffer.length > 0) {
    if (result.length > 0) {
      result[result.length - 1] += buffer;
    } else {
      result.push(buffer);
    }
  }

  return result;
}

/**
 * 文末の句読点で分割（「、」は分割しない）
 * より自然な区切りでTTSを分割したい場合に使用
 */
export function splitBySentence(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // 文末句読点のみで分割
  const sentencePattern = /([。！？!?]+)/;
  const parts = text.split(sentencePattern);
  const chunks: string[] = [];
  let current = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    if (sentencePattern.test(part)) {
      current += part;
      if (current.trim().length > 0) {
        chunks.push(current);
        current = "";
      }
    } else {
      current += part;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current);
  }

  return chunks;
}
