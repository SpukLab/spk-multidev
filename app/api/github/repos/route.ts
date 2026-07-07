import { NextResponse } from "next/server";
import { listAccountRepos } from "@/lib/github/client";

export async function GET() {
  try {
    const repos = await listAccountRepos();
    return NextResponse.json({ repos });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
