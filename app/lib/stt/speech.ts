import type {
  SpeechRecognition,
  SpeechRecognitionCallbacks,
  SpeechRecognitionConfig,
  SpeechRecognitionConstructor,
  SpeechRecognitionError,
  SpeechRecognitionErrorCode,
  SpeechRecognitionErrorEvent,
  SpeechRecognitionEvent,
  SupportedLanguage,
} from "./types/stt";

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// Error messages mapping
const ERROR_MESSAGES: Record<SpeechRecognitionErrorCode, string> = {
  "no-speech": "音声が検出されませんでした。もう一度お試しください。",
  aborted: "音声認識が中断されました。",
  "audio-capture": "マイクが見つかりません。マイクを確認してください。",
  network: "ネットワークエラーが発生しました。",
  "not-allowed":
    "マイクへのアクセスが拒否されました。マイクへのアクセスを許可してください。",
  "service-not-allowed": "音声認識サービスが許可されていません。",
  "bad-grammar": "文法エラーが発生しました。",
  "language-not-supported": "指定された言語はサポートされていません。",
};

export class SpeechRecognitionClient {
  private recognition: SpeechRecognition | null = null;
  private config: SpeechRecognitionConfig;
  private callbacks: SpeechRecognitionCallbacks;
  private _isListening = false;
  private _isSupported = false;

  constructor(
    config: Partial<SpeechRecognitionConfig> = {},
    callbacks: SpeechRecognitionCallbacks = {},
  ) {
    this.config = {
      language: config.language ?? "ja-JP",
      continuous: config.continuous ?? true,
      interimResults: config.interimResults ?? true,
    };
    this.callbacks = callbacks;
    this._isSupported = this.checkSupport();

    if (this._isSupported) {
      this.initialize();
    }
  }

  private checkSupport(): boolean {
    // Check if running in a brower enviromnent
    if (typeof window === "undefined") {
      return false;
    }
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  private initialize(): void {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognitionAPI == null) {
      return;
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.language;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (this.recognition == null) return;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;

        this.callbacks.onResult?.(transcript, isFinal);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const error: SpeechRecognitionError = {
        code: event.error,
        message: ERROR_MESSAGES[event.error] ?? `エラー: ${event.error}`,
      };

      this._isListening = false;
      this.callbacks.onError?.(error);
    };

    this.recognition.onstart = () => {
      this._isListening = true;
      this.callbacks.onStart?.();
    };

    this.recognition.onend = () => {
      this._isListening = false;
      this.callbacks.onEnd?.();
    };
  }

  get isListening(): boolean {
    return this._isListening;
  }

  get isSupported(): boolean {
    return this._isSupported;
  }

  setLanguage(language: SupportedLanguage): void {
    this.config.language = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  setCallbacks(callbacks: SpeechRecognitionCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
    if (this.recognition) {
      this.setupEventHandlers();
    }
  }

  start(): void {
    if (this.recognition == null) {
      this.callbacks.onError?.({
        code: "not-allowed",
        message: "音声認識がサポートされていません",
      });
      return;
    }

    if (this._isListening) {
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error("Failed to start recognition:", error);
      this.callbacks.onError?.({
        code: "aborted",
        message: "音声認識の開始に失敗しました",
      });
    }
  }

  stop(): void {
    if (this.recognition && this._isListening) {
      this.recognition.stop();
    }
  }

  abort(): void {
    if (this.recognition) {
      this.recognition.abort();
      this._isListening = false;
    }
  }

  dispose(): void {
    this.abort();
    if (this.recognition) {
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onstart = null;
      this.recognition.onend = null;
    }
    this.recognition = null;
  }
}
