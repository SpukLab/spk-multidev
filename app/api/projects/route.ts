import { NextRequest, NextResponse } from "next/server";
import { upsertProject, listProjects } from "@/lib/db/sessions";
import { getErrorMessage } from "@/lib/errors";

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ projects });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    const project = await upsertProject(owner, repo, branch ?? "main");
    return NextResponse.json({ project });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
