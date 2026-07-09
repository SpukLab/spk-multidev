import { NextRequest, NextResponse } from "next/server";
import { parseCodeIntake } from "@/lib/codeIntake/parser";
import { resolveInstructions } from "@/lib/codeIntake/resolve";
import { getErrorMessage } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const { rawText, owner, repo, branch, githubToken } = (await req.json()) as {
      rawText: string;
      owner: string;
      repo: string;
      branch?: string;
      githubToken?: string;
    };

    if (!rawText || !owner || !repo) {
      return NextResponse.json(
        { error: "Faltan campos: rawText, owner, repo." },
        { status: 400 }
      );
    }

    const instructions = parseCodeIntake(rawText);
    const resolved = await resolveInstructions({ owner, repo, branch }, instructions, githubToken);

    return NextResponse.json({ resolved });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
