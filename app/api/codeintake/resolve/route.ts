import { NextRequest, NextResponse } from "next/server";
import { parseCodeIntake } from "@/lib/codeIntake/parser";
import { resolveInstructions } from "@/lib/codeIntake/resolve";

export async function POST(req: NextRequest) {
  try {
    const { rawText, owner, repo, branch } = (await req.json()) as {
      rawText: string;
      owner: string;
      repo: string;
      branch?: string;
    };

    if (!rawText || !owner || !repo) {
      return NextResponse.json(
        { error: "Faltan campos: rawText, owner, repo." },
        { status: 400 }
      );
    }

    const instructions = parseCodeIntake(rawText);
    const resolved = await resolveInstructions({ owner, repo, branch }, instructions);

    return NextResponse.json({ resolved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
