"use client";

import { useState, useCallback, useRef } from "react";
import { Coeiroink, type Speaker } from "./coeiroink";

export type { Speaker };

export function useCoeiroink() {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<Coeiroink>(new Coeiroink({}));

  const getSpeakers = useCallback(async (): Promise<Speaker[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const speakerList = await clientRef.current.getSpeakers();
      setSpeakers(speakerList);
      return speakerList;
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

        clientRef.current.setSpeaker(speaker);

        // styleIdからstyleIndexを取得
        const styleIndex = speaker.styles.findIndex((s) => s.id === styleId);
        if (styleIndex === -1) {
          throw new Error(`Style not found: ${styleId}`);
        }

        const buffer = await clientRef.current.speak(text, styleIndex);
        return new Blob([new Uint8Array(buffer)], { type: "audio/wav" });
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
