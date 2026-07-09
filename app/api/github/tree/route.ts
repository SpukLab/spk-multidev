import { NextRequest, NextResponse } from "next/server";
import { listRepoTree } from "@/lib/github/client";
import { getErrorMessage } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const { owner, repo, branch, githubToken } = (await req.json()) as {
      owner: string;
      repo: string;
      branch?: string;
      githubToken?: string;
    };
    if (!owner || !repo) {
      return NextResponse.json({ error: "Faltan owner y repo." }, { status: 400 });
    }
    const files = await listRepoTree({ owner, repo, branch }, githubToken);
    return NextResponse.json({ files });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
