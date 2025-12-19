"use client";

import { useState, useCallback } from "react";
import type { Speaker } from "./coeiroink";

export type { Speaker };

export function useCoeiroink() {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSpeakers = useCallback(async (): Promise<Speaker[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/coeiroink/speakers", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch speakers: ${res.status}`);
      }
      const data = (await res.json()) as Speaker[];
      setSpeakers(data);
      return data;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch speakers";
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const synthesizeSpeech = useCallback(
    async (
      text: string,
      speakerUuid: string,
      styleId: number
    ): Promise<Blob | null> => {
      try {
        // スピーカーを設定
        const speaker = speakers.find((s) => s.speaker_uuid === speakerUuid);
        if (!speaker) {
          throw new Error(`Speaker not found: ${speakerUuid}`);
        }

        // styleIdからstyleIndexを取得
        const styleIndex = speaker.styles.findIndex((s) => s.id === styleId);
        if (styleIndex === -1) {
          throw new Error(`Style not found: ${styleId}`);
        }

        const res = await fetch("/api/coeiroink/synthesis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, speaker, styleIndex }),
        });
        if (!res.ok) {
          throw new Error(`Synthesis failed: ${res.status}`);
        }
        const blob = await res.blob();
        return blob;
      } catch (err) {
        console.error("TTS synthesis error:", err);
        return null;
      }
    },
    [speakers]
  );

  return {
    speakers,
    isLoading,
    error,
    getSpeakers,
    synthesizeSpeech,
  };
}
