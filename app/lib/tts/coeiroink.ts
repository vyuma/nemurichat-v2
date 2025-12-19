import type { Client } from "openapi-fetch";
import createClient from "openapi-fetch";
import type { components, paths } from "./types/openapi/coeiroink";
import type { TTS } from "./types/tts";

export type Speaker = components["schemas"]["Speaker"];

export class Coeiroink implements TTS<Speaker> {
  private client: Client<paths, `${string}/${string}`>;
  private speaker: Speaker | undefined;

  constructor(options: { apiUrl?: string; speaker?: Speaker }) {
    this.client = createClient<paths>({
      baseUrl:
        (options.apiUrl ?? process.env.COEIROINK_API_URL) ||
        "http://127.0.0.1:50032",
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

    const { data, error } = await this.client.POST("/v1/synthesis", {
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        speakerUuid: this.speaker.speaker_uuid,
        styleId: this.speaker.styles[style].id,
        text: text,
        speedScale: 1.0,
        volumeScale: 1.0,
        pitchScale: 0.0,
        intonationScale: 1.0,
        prePhonemeLength: 0.1,
        postPhonemeLength: 0.5,
        outputSamplingRate: 24000,
        startTrimBuffer: 0.0,
        endTrimBuffer: 0.0,
        pauseStartTrimBuffer: 0.0,
        pauseEndTrimBuffer: 0.0,
      },
      parseAs: "arrayBuffer",
    });

    if (error || !data) {
      console.error(`COEIROINK speak Error: ${error}`);
      throw error ?? new Error("COEIROINK returned no data");
    }

    const buffer = Buffer.from(data);
    return buffer;
  }

  async getSpeakers(): Promise<Speaker[]> {
    const { data, error } = await this.client.GET("/v1/speakers");

    if (error || !data) {
      console.error(`COEIROINK getSpeakers Error: ${error}`);
      throw error ?? new Error("COEIROINK returned no data");
    }

    const mapped: Speaker[] = data.map((res) => ({
      speaker_uuid: res.speakerUuid,
      name: res.speakerName,
      styles: res.styles.map((style) => ({
        id: style.styleId,
        name: style.styleName,
      })),
      version: res.version,
    }));

    return mapped;
  }

  setSpeaker(speaker: Speaker): void {
    this.speaker = speaker;
  }
}
