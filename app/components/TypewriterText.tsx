"use client";

import { useState, useEffect, useRef } from "react";

type Props = {
  /** 表示するテキストのチャンク配列 */
  chunks: string[];
  /** 現在再生中のチャンクインデックス（-1の場合は停止中） */
  currentChunkIndex: number;
  /** 再生中かどうか */
  isPlaying: boolean;
  /** 1文字あたりの表示間隔（ミリ秒）デフォルト: 50ms */
  characterDelay?: number;
  /** カーソルを表示するかどうか */
  showCursor?: boolean;
  /** カスタムクラス名 */
  className?: string;
};

export function TypewriterText({
  chunks,
  currentChunkIndex,
  isPlaying,
  characterDelay = 50,
  showCursor = true,
  className = "",
}: Props) {
  // 表示済みのテキスト（前のチャンクまで）
  const [completedText, setCompletedText] = useState("");
  // 現在タイピング中のテキスト
  const [typingText, setTypingText] = useState("");
  // 現在のチャンク内での文字インデックス
  const [charIndex, setCharIndex] = useState(0);

  // 前回のチャンクインデックスを追跡
  const prevChunkIndexRef = useRef(-1);
  // 前回のチャンク配列の長さを追跡
  const prevChunksLengthRef = useRef(0);

  // チャンクが変わった時の処理
  useEffect(() => {
    // チャンク配列が新しくなった場合（新しい発話開始時）はリセット
    if (chunks.length > 0 && prevChunksLengthRef.current === 0) {
      setCompletedText("");
      setTypingText("");
      setCharIndex(0);
      prevChunkIndexRef.current = -1;
    }
    prevChunksLengthRef.current = chunks.length;

    if (currentChunkIndex !== prevChunkIndexRef.current && currentChunkIndex >= 0) {
      // 前のチャンクまでのテキストを完成テキストに追加
      if (currentChunkIndex > 0) {
        const previousChunks = chunks.slice(0, currentChunkIndex);
        setCompletedText(previousChunks.join(""));
      } else if (currentChunkIndex === 0) {
        setCompletedText("");
      }

      // 新しいチャンクのタイピングをリセット
      setTypingText("");
      setCharIndex(0);
      prevChunkIndexRef.current = currentChunkIndex;
    }
  }, [currentChunkIndex, chunks]);

  // タイピングアニメーション
  useEffect(() => {
    if (!isPlaying || currentChunkIndex < 0 || currentChunkIndex >= chunks.length) {
      return;
    }

    const currentChunk = chunks[currentChunkIndex];
    if (!currentChunk || charIndex >= currentChunk.length) {
      return;
    }

    const timer = setTimeout(() => {
      setTypingText((prev) => prev + currentChunk[charIndex]);
      setCharIndex((prev) => prev + 1);
    }, characterDelay);

    return () => clearTimeout(timer);
  }, [chunks, currentChunkIndex, charIndex, isPlaying, characterDelay]);

  // 再生停止時は全テキストを表示
  useEffect(() => {
    if (!isPlaying && chunks.length > 0) {
      // 停止時は全チャンクを表示
      setCompletedText(chunks.join(""));
      setTypingText("");
    }
  }, [isPlaying, chunks]);

  // 全文表示（完成テキスト + タイピング中テキスト）
  const displayedText = completedText + typingText;

  return (
    <span className={className}>
      {displayedText}
      {showCursor && isPlaying && (
        <span className="inline-block w-0.5 h-4 bg-current animate-pulse ml-0.5" />
      )}
    </span>
  );
}

/**
 * シンプルなタイプライターテキスト（チャンク分割なし）
 * 単純な文字列を1文字ずつ表示する場合に使用
 */
export function SimpleTypewriterText({
  text,
  isPlaying,
  characterDelay = 50,
  showCursor = true,
  className = "",
  onComplete,
}: {
  text: string;
  isPlaying: boolean;
  characterDelay?: number;
  showCursor?: boolean;
  className?: string;
  onComplete?: () => void;
}) {
  const [displayedText, setDisplayedText] = useState("");
  const [charIndex, setCharIndex] = useState(0);
  const hasCompletedRef = useRef(false);

  // テキストが変わったらリセット
  useEffect(() => {
    setDisplayedText("");
    setCharIndex(0);
    hasCompletedRef.current = false;
  }, [text]);

  // タイピングアニメーション
  useEffect(() => {
    if (!isPlaying || !text || charIndex >= text.length) {
      // 完了時のコールバック
      if (charIndex >= text.length && !hasCompletedRef.current && onComplete) {
        hasCompletedRef.current = true;
        onComplete();
      }
      return;
    }

    const timer = setTimeout(() => {
      setDisplayedText((prev) => prev + text[charIndex]);
      setCharIndex((prev) => prev + 1);
    }, characterDelay);

    return () => clearTimeout(timer);
  }, [text, charIndex, isPlaying, characterDelay, onComplete]);

  // 再生停止時は全テキストを表示
  useEffect(() => {
    if (!isPlaying && text) {
      setDisplayedText(text);
    }
  }, [isPlaying, text]);

  return (
    <span className={className}>
      {displayedText}
      {showCursor && isPlaying && charIndex < text.length && (
        <span className="inline-block w-0.5 h-4 bg-current animate-pulse ml-0.5" />
      )}
    </span>
  );
}
