import type { Client } from "openapi-fetch";
import createClient from "openapi-fetch";
import type { components, paths } from "./types/openapi/voicevox";
import type { TTS } from "./types/tts";

export type Speaker = components["schemas"]["Speaker"];

export class Voicevox implements TTS<Speaker> {
  private client: Client<paths, `${string}/${string}`>;
  private speaker: Speaker | undefined;

  constructor(options: { apiUrl?: string; speaker?: Speaker }) {
    this.client = createClient<paths>({
      baseUrl:
        (options.apiUrl ?? process.env.VOICEVOX_API_URL) ||
        "http://127.0.0.1:50021",
    });
    this.speaker = options.speaker ?? undefined;
  }

  async speak(text: string, style: number = 0): Promise<Buffer> {
    // speakerが設定されているか確認
    if (!this.speaker) {
      throw new Error("Speaker is not set. Please call setSpeaker() first.");
    }

    // 該当のstyle indexが存在するか確認
    if (style < 0 || style >= this.speaker.styles.length) {
      throw new Error(
        `Invalid style index: ${style}. Available styles: 0-${this.speaker.styles.length - 1}`,
      );
    }

    // クエリの作成
    const { data: queryData, error: queryError } = await this.client.POST(
      "/audio_query",
      {
        params: {
          query: {
            text: text,
            speaker: this.speaker.styles[style].id,
          },
        },
      },
    );

    // エラーが発生 / データを受け取れなかった
    if (queryError || !queryData) {
      console.error(
        `VOICEVOX audio_query Error: ${JSON.stringify(queryError, null, 2)}`,
      );
      throw queryError ?? new Error("VOICEVOX returned no data");
    }

    // 音声合成
    const { data: synthesisData, error: synthesisError } =
      await this.client.POST("/synthesis", {
        params: {
          query: {
            speaker: this.speaker.styles[style].id,
          },
        },
        body: queryData,
        parseAs: "arrayBuffer",
      });

    // エラーが発生 / データを受け取れなかった
    if (synthesisError || !synthesisData) {
      console.error(
        `VOICEVOX synthesis Error: ${JSON.stringify(synthesisError, null, 2)}`,
      );
      throw synthesisError ?? new Error("VOICEVOX returned no data");
    }

    const buffer = Buffer.from(synthesisData);
    return buffer;
  }

  async getSpeakers(): Promise<Speaker[]> {
    const { data, error } = await this.client.GET("/speakers");

    if (error || !data) {
      console.error(
        `VOICEVOX getSpeakers Error: ${JSON.stringify(error, null, 2)}`,
      );
      throw error ?? new Error("VOICEVOX returned no data");
    }

    return data as Speaker[];
  }

  setSpeaker(speaker: Speaker): void {
    this.speaker = speaker;
  }
}
