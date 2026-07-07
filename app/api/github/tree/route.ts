import { NextRequest, NextResponse } from "next/server";
import { listRepoTree } from "@/lib/github/client";

export async function POST(req: NextRequest) {
  try {
    const { owner, repo, branch } = (await req.json()) as {
      owner: string;
      repo: string;
      branch?: string;
    };
    if (!owner || !repo) {
      return NextResponse.json({ error: "Faltan owner y repo." }, { status: 400 });
    }
    const files = await listRepoTree({ owner, repo, branch });
    return NextResponse.json({ files });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
