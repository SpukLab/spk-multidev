import { NextRequest, NextResponse } from "next/server";
import { parseCodeIntake } from "@/lib/codeIntake/parser";

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();
    if (typeof rawText !== "string") {
      return NextResponse.json({ error: "Falta rawText (string)." }, { status: 400 });
    }

    const instructions = parseCodeIntake(rawText);
    return NextResponse.json({ instructions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
