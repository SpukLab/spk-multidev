import { NextRequest, NextResponse } from "next/server";
import { listAccountRepos } from "@/lib/github/client";

export async function POST(req: NextRequest) {
  try {
    const { githubToken } = (await req.json().catch(() => ({}))) as { githubToken?: string };
    const repos = await listAccountRepos(githubToken);
    return NextResponse.json({ repos });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
