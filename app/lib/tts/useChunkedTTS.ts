"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { splitByPunctuation } from "../text/splitByPunctuation";

export type TTSChunkStatus = "pending" | "loading" | "ready" | "playing" | "done" | "error";

export type TTSChunk = {
  text: string;
  audioBlob: Blob | null;
  status: TTSChunkStatus;
};

type SynthesizeFn = (
  text: string,
  speakerUuid: string,
  styleId: number
) => Promise<Blob | null>;

type UseChunkedTTSOptions = {
  speakerUuid: string;
  styleId: number;
  synthesizeSpeech: SynthesizeFn;
  prefetchCount?: number; // 先行fetch数（デフォルト: 2）
};

type ChunkStartCallback = (index: number, text: string) => void;
type ChunkEndCallback = (index: number) => void;
type AllCompleteCallback = () => void;

export type UseChunkedTTSReturn = {
  chunks: TTSChunk[];
  currentChunkIndex: number;
  isLoading: boolean;
  isPlaying: boolean;
  startSynthesis: (text: string) => Promise<void>;
  stop: () => void;
  setOnChunkStart: (callback: ChunkStartCallback | null) => void;
  setOnChunkEnd: (callback: ChunkEndCallback | null) => void;
  setOnAllComplete: (callback: AllCompleteCallback | null) => void;
};

export function useChunkedTTS({
  speakerUuid,
  styleId,
  synthesizeSpeech,
  prefetchCount = 2,
}: UseChunkedTTSOptions): UseChunkedTTSReturn {
  const [chunks, setChunks] = useState<TTSChunk[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // refs for callbacks (単一のコールバックとして保持)
  const onChunkStartCallbackRef = useRef<ChunkStartCallback | null>(null);
  const onChunkEndCallbackRef = useRef<ChunkEndCallback | null>(null);
  const onAllCompleteCallbackRef = useRef<AllCompleteCallback | null>(null);

  // audio element ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<TTSChunk[]>([]);
  const isStoppedRef = useRef(false);
  const currentUrlRef = useRef<string | null>(null);
  // 進行中のフェッチを追跡（プリフェッチとの競合を防ぐ）
  const pendingFetchesRef = useRef<Map<number, Promise<boolean>>>(new Map());

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
      }
    };
  }, []);

  // Keep chunksRef in sync
  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);

  // Fetch a single chunk's audio
  const fetchChunk = useCallback(
    async (index: number): Promise<boolean> => {
      if (index < 0 || index >= chunksRef.current.length) {
        return false;
      }

      const chunk = chunksRef.current[index];

      // 既に完了している場合
      if (chunk?.status === "ready") {
        return true;
      }

      // 既にフェッチ中の場合は、そのPromiseを待つ
      const existingFetch = pendingFetchesRef.current.get(index);
      if (existingFetch) {
        return existingFetch;
      }

      // エラーまたは不明な状態の場合
      if (!chunk || (chunk.status !== "pending" && chunk.status !== "loading")) {
        return false;
      }

      // 新しいフェッチを開始
      const fetchPromise = (async (): Promise<boolean> => {
        // Update status to loading
        setChunks((prev) =>
          prev.map((c, i) => (i === index ? { ...c, status: "loading" } : c))
        );

        try {
          const audioBlob = await synthesizeSpeech(chunk.text, speakerUuid, styleId);

          if (isStoppedRef.current) {
            pendingFetchesRef.current.delete(index);
            return false;
          }

          if (audioBlob) {
            setChunks((prev) =>
              prev.map((c, i) =>
                i === index ? { ...c, audioBlob, status: "ready" } : c
              )
            );
            chunksRef.current[index] = {
              ...chunksRef.current[index],
              audioBlob,
              status: "ready",
            };
            pendingFetchesRef.current.delete(index);
            return true;
          } else {
            setChunks((prev) =>
              prev.map((c, i) => (i === index ? { ...c, status: "error" } : c))
            );
            pendingFetchesRef.current.delete(index);
            return false;
          }
        } catch (error) {
          console.error(`Failed to fetch chunk ${index}:`, error);
          setChunks((prev) =>
            prev.map((c, i) => (i === index ? { ...c, status: "error" } : c))
          );
          pendingFetchesRef.current.delete(index);
          return false;
        }
      })();

      pendingFetchesRef.current.set(index, fetchPromise);
      return fetchPromise;
    },
    [synthesizeSpeech, speakerUuid, styleId]
  );

  // Prefetch next chunks
  const prefetchNextChunks = useCallback(
    async (startIndex: number) => {
      const promises: Promise<boolean>[] = [];
      for (let i = 0; i < prefetchCount; i++) {
        const idx = startIndex + i;
        if (idx < chunksRef.current.length) {
          const chunk = chunksRef.current[idx];
          if (chunk && chunk.status === "pending") {
            promises.push(fetchChunk(idx));
          }
        }
      }
      await Promise.all(promises);
    },
    [fetchChunk, prefetchCount]
  );

  // Play a specific chunk
  const playChunk = useCallback(
    async (index: number) => {
      if (isStoppedRef.current || !audioRef.current) {
        return;
      }

      if (index >= chunksRef.current.length) {
        // All chunks done
        setIsPlaying(false);
        setCurrentChunkIndex(-1);
        onAllCompleteCallbackRef.current?.();
        return;
      }

      const chunk = chunksRef.current[index];

      // Wait for chunk to be ready
      if (!chunk || chunk.status !== "ready" || !chunk.audioBlob) {
        // Try to fetch it
        const success = await fetchChunk(index);
        if (!success || isStoppedRef.current) {
          // Skip this chunk and move to next
          console.warn(`Skipping chunk ${index} due to fetch failure`);
          onChunkEndCallbackRef.current?.(index);
          playChunk(index + 1);
          return;
        }
      }

      const readyChunk = chunksRef.current[index];
      if (!readyChunk?.audioBlob) {
        playChunk(index + 1);
        return;
      }

      // Clean up previous URL
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
      }

      const url = URL.createObjectURL(readyChunk.audioBlob);
      currentUrlRef.current = url;

      // Update status
      setChunks((prev) =>
        prev.map((c, i) => (i === index ? { ...c, status: "playing" } : c))
      );
      setCurrentChunkIndex(index);

      // Notify chunk start
      onChunkStartCallbackRef.current?.(index, readyChunk.text);

      // Start prefetching next chunks
      prefetchNextChunks(index + 1);

      audioRef.current.src = url;

      audioRef.current.onended = () => {
        if (isStoppedRef.current) return;

        // Update status
        setChunks((prev) =>
          prev.map((c, i) => (i === index ? { ...c, status: "done" } : c))
        );

        // Notify chunk end
        onChunkEndCallbackRef.current?.(index);

        // 次のチャンクがある場合、すぐにインデックスを更新（タイプライター表示の同期のため）
        const nextIndex = index + 1;
        if (nextIndex < chunksRef.current.length) {
          setCurrentChunkIndex(nextIndex);
        }

        // Play next chunk
        playChunk(nextIndex);
      };

      audioRef.current.onerror = () => {
        console.error(`Error playing chunk ${index}`);
        onChunkEndCallbackRef.current?.(index);
        playChunk(index + 1);
      };

      try {
        // 再生前に停止されていないか確認
        if (isStoppedRef.current) {
          return;
        }
        await audioRef.current.play();
      } catch (error) {
        // AbortErrorは意図的な停止の場合があるので、停止フラグをチェック
        if (isStoppedRef.current) {
          return;
        }
        console.error(`Failed to play chunk ${index}:`, error);
        onChunkEndCallbackRef.current?.(index);
        playChunk(index + 1);
      }
    },
    [fetchChunk, prefetchNextChunks]
  );

  // Start synthesis and playback
  const startSynthesis = useCallback(
    async (fullText: string) => {
      // Stop any existing playback
      isStoppedRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        // イベントハンドラをクリア
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
      }
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }

      // Reset state
      isStoppedRef.current = false;
      setIsLoading(true);
      setCurrentChunkIndex(-1);
      pendingFetchesRef.current.clear();

      // Split text into chunks
      const textChunks = splitByPunctuation(fullText);

      if (textChunks.length === 0) {
        setIsLoading(false);
        onAllCompleteCallbackRef.current?.();
        return;
      }

      // Initialize chunks
      const newChunks: TTSChunk[] = textChunks.map((text) => ({
        text,
        audioBlob: null,
        status: "pending",
      }));
      setChunks(newChunks);
      chunksRef.current = newChunks;

      // Fetch first chunk
      const firstSuccess = await fetchChunk(0);

      if (isStoppedRef.current) {
        setIsLoading(false);
        return;
      }

      setIsLoading(false);

      if (!firstSuccess) {
        console.error("Failed to fetch first chunk");
        onAllCompleteCallbackRef.current?.();
        return;
      }

      // Start playback
      setIsPlaying(true);
      playChunk(0);
    },
    [fetchChunk, playChunk]
  );

  // Stop playback
  const stop = useCallback(() => {
    isStoppedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }
    pendingFetchesRef.current.clear();
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentChunkIndex(-1);
  }, []);

  // Callback setters
  const setOnChunkStart = useCallback((callback: ChunkStartCallback | null) => {
    onChunkStartCallbackRef.current = callback;
  }, []);

  const setOnChunkEnd = useCallback((callback: ChunkEndCallback | null) => {
    onChunkEndCallbackRef.current = callback;
  }, []);

  const setOnAllComplete = useCallback((callback: AllCompleteCallback | null) => {
    onAllCompleteCallbackRef.current = callback;
  }, []);

  return {
    chunks,
    currentChunkIndex,
    isLoading,
    isPlaying,
    startSynthesis,
    stop,
    setOnChunkStart,
    setOnChunkEnd,
    setOnAllComplete,
  };
}
