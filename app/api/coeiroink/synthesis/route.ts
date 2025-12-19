import { NextRequest, NextResponse } from "next/server";
import { Coeiroink, type Speaker } from "../../../lib/tts/coeiroink";

interface SynthesisRequest {
  text: string;
  speaker: Speaker;
  styleIndex?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: SynthesisRequest = await request.json();
    const { text, speaker, styleIndex = 0 } = body;

    const coeiroink = new Coeiroink({ speaker });
    const audioBuffer = await coeiroink.speak(text, styleIndex);

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
      },
    });
  } catch (error) {
    console.error("COEIROINK synthesis error:", error);
    return NextResponse.json(
      { error: "Failed to synthesize speech from COEIROINK" },
      { status: 500 }
    );
  }
}
