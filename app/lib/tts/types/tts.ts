export interface TTS<S> {
  speak(text: string): Promise<Buffer>;
  getSpeakers(): Promise<S[]>;
  setSpeaker(speaker: S): void;
}
