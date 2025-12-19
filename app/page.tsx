"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import VRMChat from "./components/VRMChat";
import { useSpeechRecognition } from "./lib/stt";
import { useCoeiroink, type Speaker } from "./lib/tts/useCoeiroink";
import { useChunkedTTS } from "./lib/tts/useChunkedTTS";
import { TypewriterText } from "./components/TypewriterText";
import {
  type VRMExpression,
  type VRMAnimation,
  VRM_EXPRESSIONS,
  VRM_ANIMATIONS,
  EXPRESSION_LABELS,
  ANIMATION_LABELS,
} from "./lib/vrm/expressions";


type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [_goal, setGoal] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);
  const [selectedStyleIndex, setSelectedStyleIndex] = useState(0);
  const [showSpeakerSelector, setShowSpeakerSelector] = useState(false);
  const [isLoadingSpeakers, setIsLoadingSpeakers] = useState(true);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [currentExpression, setCurrentExpression] = useState<VRMExpression>("neutral");
  const [currentAnimation, setCurrentAnimation] = useState<VRMAnimation>("idle");
  const [showExpressionSelector, setShowExpressionSelector] = useState(false);
  const [showAnimationSelector, setShowAnimationSelector] = useState(false);
  // 現在再生中のメッセージインデックス（タイプライター表示用）
  const [playingMessageIndex, setPlayingMessageIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasGreetedRef = useRef(false);

  // クライアントサイドでCOEIROINKに直接アクセス
  const {
    speakers,
    error: speakerError,
    getSpeakers,
    synthesizeSpeech,
  } = useCoeiroink();

  // チャンクTTSフック
  const {
    chunks: ttsChunks,
    currentChunkIndex,
    isLoading: isTTSLoading,
    isPlaying: isTTSPlaying,
    startSynthesis,
    stop: stopTTS,
    setOnChunkStart,
    setOnChunkEnd,
    setOnAllComplete,
  } = useChunkedTTS({
    speakerUuid: selectedSpeaker?.speaker_uuid ?? "",
    styleId: selectedSpeaker?.styles[selectedStyleIndex]?.id ?? 0,
    synthesizeSpeech,
  });

  // TTSチャンクからテキスト配列を取得
  const displayChunks = ttsChunks.map(chunk => chunk.text);
  // タイプライター再生中かどうか
  const isTypewriterPlaying = isTTSPlaying && playingMessageIndex >= 0;

  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    clearTranscript,
    isSupported,
  } = useSpeechRecognition({
    language: "ja-JP",
    continuous: true,
    interimResults: true,
  });

  // 無音検出用のタイマー
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptRef = useRef<string>("");
  const SILENCE_THRESHOLD_MS = 2500; // 3.5秒

  // MANAの「ねむねむ」スタイルを固定で使用
  const MANA_SPEAKER_UUID = "292ea286-3d5f-f1cc-157c-66462a6a9d08";
  const NEMUNEMU_STYLE_ID = 46;

  // スピーカー一覧を取得し、MANAの「ねむねむ」スタイルを設定
  useEffect(() => {
    const loadSpeakers = async () => {
      setIsLoadingSpeakers(true);
      const speakerList = await getSpeakers();
      if (speakerList.length > 0) {
        // MANAを探す
        const mana = speakerList.find(s => s.speaker_uuid === MANA_SPEAKER_UUID);
        if (mana) {
          setSelectedSpeaker(mana);
          // 「ねむねむ」スタイルのインデックスを探す
          const nemunemuIndex = mana.styles.findIndex(style => style.id === NEMUNEMU_STYLE_ID);
          if (nemunemuIndex >= 0) {
            setSelectedStyleIndex(nemunemuIndex);
          }
        } else {
          // MANAが見つからない場合は最初のスピーカーを使用
          setSelectedSpeaker(speakerList[0]);
        }
      }
      setIsLoadingSpeakers(false);
    };

    loadSpeakers();
  }, [getSpeakers]);

  // チャンクTTSのコールバック設定
  useEffect(() => {
    // チャンク開始時
    setOnChunkStart((_index, _text) => {
      setIsSpeaking(true);
    });

    // チャンク終了時
    setOnChunkEnd((_index) => {
      // 次のチャンクに進む（特に処理不要）
    });

    // 全チャンク完了時
    setOnAllComplete(() => {
      setIsSpeaking(false);
      setPlayingMessageIndex(-1);
      // 発話終了後に表情をneutralに戻す（少し遅延を入れる）
      setTimeout(() => {
        setCurrentExpression("neutral");
        setCurrentAnimation("idle");
      }, 2000);
      // 発話終了後に自動でリスニングを開始
      startListening();
    });

    // クリーンアップ
    return () => {
      setOnChunkStart(null);
      setOnChunkEnd(null);
      setOnAllComplete(null);
    };
  }, [setOnChunkStart, setOnChunkEnd, setOnAllComplete, startListening]);

  // 新しいチャンクベースのspeakText
  const speakText = useCallback(
    async (text: string, messageIndex: number) => {
      if (!selectedSpeaker) {
        console.error("Speaker not selected");
        return;
      }

      // 再生中のメッセージインデックスを設定
      setPlayingMessageIndex(messageIndex);

      // チャンクTTS開始（チャンク分割はuseChunkedTTS内で行われる）
      await startSynthesis(text);
    },
    [selectedSpeaker, startSynthesis]
  );

  // 旧speakText（挨拶用にシンプルなバージョンを残す）
  const speakTextSimple = useCallback(
    async (text: string) => {
      if (!selectedSpeaker) {
        console.error("Speaker not selected");
        return;
      }

      setIsSpeaking(true);

      try {
        const styleId = selectedSpeaker.styles[selectedStyleIndex]?.id ?? 0;
        const audioBlob = await synthesizeSpeech(
          text,
          selectedSpeaker.speaker_uuid,
          styleId
        );

        if (!audioBlob) {
          console.error("Failed to get audio data");
          setIsSpeaking(false);
          return;
        }

        const audioUrl = URL.createObjectURL(audioBlob);

        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.onended = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            setTimeout(() => {
              setCurrentExpression("neutral");
            }, 2000);
            startListening();
          };
          audioRef.current.onerror = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            setCurrentExpression("neutral");
            startListening();
          };
          await audioRef.current.play();
        }
      } catch (error) {
        console.error("TTS Error:", error);
        setIsSpeaking(false);
      }
    },
    [selectedSpeaker, selectedStyleIndex, synthesizeSpeech, startListening]
  );

  // ユーザー操作後に挨拶を再生
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedSpeaker) return;
    if (!hasUserInteracted) return;
    if (hasGreetedRef.current) return;

    hasGreetedRef.current = true;

    const savedGoal = sessionStorage.getItem("todayGoal");
    if (savedGoal) {
      setGoal(savedGoal);
    }

    const greetingText = savedGoal
      ? ""
      : "ふわー、こんにちは、ねむりだよ.... 今日は何かな？";

    setMessages([{ role: "assistant", content: greetingText }]);
    setCurrentExpression("happy");

    setTimeout(() => {
      // 挨拶はシンプルなTTSで再生
      speakTextSimple(greetingText);
    }, 500);
  }, [selectedSpeaker, speakTextSimple, hasUserInteracted]);

  // 開始ボタンクリック時の処理
  const handleStart = useCallback(() => {
    setHasUserInteracted(true);
  }, []);

  const handleSend = useCallback(async () => {
    const userText = transcript.trim();
    if (!userText) return;

    const newUserMessage: Message = { role: "user", content: userText };
    setMessages((prev) => [...prev, newUserMessage]);
    clearTranscript();
    stopListening();

    // 考え中状態を開始
    setIsThinking(true);
    setCurrentAnimation("thinking");

    try {
      // 目標を取得
      const goal = sessionStorage.getItem("todayGoal") || undefined;

      // APIを呼び出してAI応答を取得
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, newUserMessage],
          goal,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API Error:", response.status, errorData);
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.content;

      // 感情情報を取得（LLMから返却）
      const expression = (data.emotion?.expression as VRMExpression) || "neutral";
      const animation = (data.animation as VRMAnimation) || "idle";

      // 考え中状態を終了
      setIsThinking(false);

      // 表情とアニメーションを設定
      setCurrentExpression(expression);
      setCurrentAnimation(animation);

      // メッセージを追加
      const newMessageIndex = messages.length + 1; // +1 for user message
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: responseText },
      ]);

      // チャンクTTSで発話開始
      speakText(responseText, newMessageIndex);
    } catch (error) {
      console.error("Chat API Error:", error);
      setIsThinking(false);

      // エラー時はフォールバックメッセージ
      const fallbackText = "う〜んよく聞き取れなかったな〜？";
      const newMessageIndex = messages.length + 1;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: fallbackText },
      ]);
      speakText(fallbackText, newMessageIndex);
    }
  }, [transcript, clearTranscript, stopListening, speakText, messages]);

  // 無音検出: transcriptまたはinterimTranscriptが3.5秒間変化しなかったら自動送信
  useEffect(() => {
    // リスニング中でない場合、または発話中の場合はタイマーをクリア
    if (!isListening || isSpeaking) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      lastTranscriptRef.current = "";
      return;
    }

    const currentTranscript = transcript + interimTranscript;

    // transcriptが空の場合はタイマーを開始しない
    if (!transcript.trim()) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      lastTranscriptRef.current = currentTranscript;
      return;
    }

    // transcriptが変化した場合、タイマーをリセットして再開始
    if (currentTranscript !== lastTranscriptRef.current) {
      lastTranscriptRef.current = currentTranscript;

      // 既存のタイマーをクリア
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }

    // タイマーが動いていない場合は開始
    if (!silenceTimerRef.current && transcript.trim()) {
      silenceTimerRef.current = setTimeout(() => {
        // 3.5秒間変化がなかった場合、自動送信
        handleSend();
        silenceTimerRef.current = null;
      }, SILENCE_THRESHOLD_MS);
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [transcript, interimTranscript, isListening, isSpeaking, handleSend]);

  const handleBack = () => {
    sessionStorage.removeItem("todayGoal");
    router.push("/home");
  };

  const handleSpeakerChange = (speakerUuid: string) => {
    const speaker = speakers.find((s) => s.speaker_uuid === speakerUuid);
    if (speaker) {
      setSelectedSpeaker(speaker);
      setSelectedStyleIndex(0);
    }
  };

  const handleStyleChange = (styleIndex: number) => {
    setSelectedStyleIndex(styleIndex);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div className="absolute inset-0 z-0">
        <VRMChat
          isSpeaking={isSpeaking}
          isThinking={isThinking}
          expression={currentExpression}
          animation={currentAnimation}
        />
      </div>

      {/* 開始オーバーレイ - ユーザー操作前に表示 */}
      {!hasUserInteracted && !isLoadingSpeakers && selectedSpeaker && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
          <button
            onClick={handleStart}
            className="px-8 py-4 bg-amber-500 text-white text-xl font-bold rounded-2xl shadow-lg hover:bg-amber-600 transition transform hover:scale-105 active:scale-95"
          >
            タップして開始
          </button>
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full">
        <div className="p-4 flex items-center gap-2">
          {/* スピーカー選択ボタン */}
          <button
            onClick={() => setShowSpeakerSelector(!showSpeakerSelector)}
            disabled={isLoadingSpeakers || !!speakerError}
            className="p-2 bg-white/80 rounded-full shadow-lg hover:bg-white transition disabled:opacity-50"
            title="音声を選択"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          </button>

          {/* 表情選択ボタン */}
          <button
            onClick={() => setShowExpressionSelector(!showExpressionSelector)}
            className="p-2 bg-white/80 rounded-full shadow-lg hover:bg-white transition"
            title="表情を選択"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>

          {/* アニメーション選択ボタン */}
          <button
            onClick={() => setShowAnimationSelector(!showAnimationSelector)}
            className="p-2 bg-white/80 rounded-full shadow-lg hover:bg-white transition"
            title="アニメーションを選択"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v4" />
              <path d="M12 18v4" />
              <path d="M4.93 4.93l2.83 2.83" />
              <path d="M16.24 16.24l2.83 2.83" />
              <path d="M2 12h4" />
              <path d="M18 12h4" />
              <path d="M4.93 19.07l2.83-2.83" />
              <path d="M16.24 7.76l2.83-2.83" />
            </svg>
          </button>

          {selectedSpeaker && (
            <span className="text-sm bg-white/80 px-3 py-1 rounded-full shadow">
              {selectedSpeaker.name}
              {selectedSpeaker.styles.length > 1 &&
                ` - ${selectedSpeaker.styles[selectedStyleIndex]?.name}`}
            </span>
          )}
        </div>

        {/* スピーカー選択パネル */}
        {showSpeakerSelector && (
          <div className="mx-4 p-4 bg-white/95 rounded-2xl shadow-lg space-y-3">
            <h3 className="font-bold text-gray-800">音声を選択</h3>

            {speakerError && (
              <p className="text-red-500 text-sm">{speakerError}</p>
            )}

            {isLoadingSpeakers ? (
              <p className="text-gray-500">読み込み中...</p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="block text-sm text-gray-600">
                    キャラクター
                  </label>
                  <select
                    value={selectedSpeaker?.speaker_uuid ?? ""}
                    onChange={(e) => handleSpeakerChange(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    {speakers.map((speaker) => (
                      <option
                        key={speaker.speaker_uuid}
                        value={speaker.speaker_uuid}
                      >
                        {speaker.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSpeaker && selectedSpeaker.styles.length > 1 && (
                  <div className="space-y-2">
                    <label className="block text-sm text-gray-600">
                      スタイル
                    </label>
                    <select
                      value={selectedStyleIndex}
                      onChange={(e) =>
                        handleStyleChange(Number(e.target.value))
                      }
                      className="w-full p-2 border rounded-lg bg-white"
                    >
                      {selectedSpeaker.styles.map((style, index) => (
                        <option key={style.id} value={index}>
                          {style.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={() => setShowSpeakerSelector(false)}
                  className="w-full p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                >
                  閉じる
                </button>
              </>
            )}
          </div>
        )}

        {/* 表情選択パネル */}
        {showExpressionSelector && (
          <div className="mx-4 p-4 bg-white/95 rounded-2xl shadow-lg space-y-3">
            <h3 className="font-bold text-gray-800">表情を選択</h3>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(VRM_EXPRESSIONS) as VRMExpression[]).map((expr) => (
                <button
                  key={expr}
                  onClick={() => {
                    setCurrentExpression(expr);
                    setShowExpressionSelector(false);
                  }}
                  className={`p-2 rounded-lg text-sm transition ${currentExpression === expr
                    ? "bg-amber-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                >
                  {EXPRESSION_LABELS[expr]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowExpressionSelector(false)}
              className="w-full p-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
            >
              閉じる
            </button>
          </div>
        )}

        {/* アニメーション選択パネル */}
        {showAnimationSelector && (
          <div className="mx-4 p-4 bg-white/95 rounded-2xl shadow-lg space-y-3">
            <h3 className="font-bold text-gray-800">アニメーションを選択</h3>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(VRM_ANIMATIONS) as VRMAnimation[]).map((anim) => (
                <button
                  key={anim}
                  onClick={() => {
                    setCurrentAnimation(anim);
                    setShowAnimationSelector(false);
                  }}
                  className={`p-2 rounded-lg text-sm transition ${currentAnimation === anim
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                >
                  {ANIMATION_LABELS[anim]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAnimationSelector(false)}
              className="w-full p-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
            >
              閉じる
            </button>
          </div>
        )}

        <div className="flex-1" />

        <div className="p-4 space-y-4">
          <div className="max-h-48 overflow-y-auto space-y-2">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`p-3 rounded-2xl max-w-[80%] ${msg.role === "assistant"
                  ? "bg-amber-100/90 text-amber-900 self-start"
                  : "bg-white/90 text-gray-800 self-end ml-auto"
                  }`}
              >
                {/* タイプライター表示（再生中の最後のアシスタントメッセージのみ） */}
                {msg.role === "assistant" &&
                  index === playingMessageIndex &&
                  isTypewriterPlaying ? (
                  <TypewriterText
                    chunks={displayChunks}
                    currentChunkIndex={currentChunkIndex}
                    isPlaying={isTypewriterPlaying}
                    characterDelay={40}
                  />
                ) : (
                  msg.content
                )}
              </div>
            ))}
            {/* 考え中インジケーター */}
            {isThinking && (
              <div className="p-3 rounded-2xl max-w-[80%] bg-amber-100/90 text-amber-900 self-start">
                <span className="inline-flex items-center gap-1">
                  <span className="animate-pulse">考え中</span>
                  <span className="animate-bounce">...</span>
                </span>
              </div>
            )}
          </div>

          {(transcript || interimTranscript) && (
            <div className="bg-white/90 p-3 rounded-2xl text-gray-800">
              {transcript}
              <span className="text-gray-400">{interimTranscript}</span>
            </div>
          )}

          <div className="flex items-center gap-3 bg-white/90 p-3 rounded-2xl shadow-lg">
            {/* リスニング状態のインジケーター */}
            <div
              className={`p-3 rounded-full ${isListening
                ? "bg-red-500 animate-pulse"
                : isSpeaking
                  ? "bg-amber-500"
                  : "bg-gray-300"
                }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="white"
              >
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>

            <div className="flex-1 text-gray-600 text-sm">
              {isLoadingSpeakers
                ? "音声エンジン初期化中..."
                : speakerError
                  ? "COEIROINKに接続できません"
                  : !selectedSpeaker
                    ? "スピーカーを選択してください"
                    : isSpeaking
                      ? "話し中..."
                      : isListening
                        ? "話しかけてね..."
                        : "準備中..."}
            </div>

            {/* 送信ボタン */}
            <button
              onClick={handleSend}
              disabled={!transcript.trim() || isSpeaking || !selectedSpeaker}
              className={`p-3 rounded-full bg-amber-500 text-white transition ${!transcript.trim() || isSpeaking || !selectedSpeaker
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-amber-600"
                }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>

          {!isSupported && (
            <p className="text-center text-red-500 text-sm bg-white/80 p-2 rounded-lg">
              お使いのブラウザは音声認識に対応していません
            </p>
          )}
        </div>
      </div>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
