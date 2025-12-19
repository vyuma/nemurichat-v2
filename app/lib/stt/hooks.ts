"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SpeechRecognitionClient } from "./speech";
import type {
  SpeechRecognitionError,
  SpeechRecognitionState,
  SupportedLanguage,
} from "./types/stt";

export interface UseSpeechRecognitionOptions {
  language?: SupportedLanguage;
  continuous?: boolean;
  interimResults?: boolean;
  autoRestart?: boolean;
}

export interface UseSpeechRecognitionReturn extends SpeechRecognitionState {
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  clearTranscript: () => void;
  setLanguage: (language: SupportedLanguage) => void;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const {
    language: initialLanguage = "ja-JP",
    continuous = true,
    interimResults = true,
    autoRestart = false,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<SpeechRecognitionError | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [language, setLanguageState] =
    useState<SupportedLanguage>(initialLanguage);

  const clientRef = useRef<SpeechRecognitionClient | null>(null);
  const shouldRestartRef = useRef(false);

  useEffect(() => {
    const client = new SpeechRecognitionClient(
      {
        language,
        continuous,
        interimResults,
      },
      {
        onResult: (text, isFinal) => {
          if (isFinal) {
            setTranscript((prev) => prev + text);
            setInterimTranscript("");
          } else {
            setInterimTranscript(text);
          }
        },
        onError: (err) => {
          setError(err);
          setIsListening(false);
        },
        onStart: () => {
          setIsListening(true);
          setError(null);
        },
        onEnd: () => {
          setIsListening(false);
          setInterimTranscript("");

          if (autoRestart && shouldRestartRef.current) {
            client.start();
          }
        },
      },
    );

    clientRef.current = client;
    setIsSupported(client.isSupported);

    return () => {
      client.dispose();
    };
  }, [language, continuous, interimResults, autoRestart]);

  const startListening = useCallback(() => {
    if (clientRef.current) {
      setError(null);
      shouldRestartRef.current = true;
      clientRef.current.start();
    }
  }, []);

  const stopListening = useCallback(() => {
    if (clientRef.current) {
      shouldRestartRef.current = false;
      clientRef.current.stop();
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const setLanguage = useCallback((newLanguage: SupportedLanguage) => {
    setLanguageState(newLanguage);
    if (clientRef.current) {
      clientRef.current.setLanguage(newLanguage);
    }
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    setLanguage,
  };
}
