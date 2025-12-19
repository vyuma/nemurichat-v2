import { NextResponse } from "next/server";
import { Coeiroink } from "../../../lib/tts/coeiroink";

export async function GET() {
  try {
    const coeiroink = new Coeiroink({});
    const speakers = await coeiroink.getSpeakers();
    return NextResponse.json(speakers);
  } catch (error) {
    console.error("COEIROINK speakers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch speakers from COEIROINK" },
      { status: 500 }
    );
  }
}
