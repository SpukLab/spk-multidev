import { NextRequest, NextResponse } from "next/server";
import { parseCodeIntake } from "@/lib/codeIntake/parser";
import { resolveInstructions } from "@/lib/codeIntake/resolve";
import { getErrorMessage } from "@/lib/errors";
import { emitEvent } from "@/lib/events/emit";
import { getBranchHeadSha } from "@/lib/github/client";
import { issueResolutionProof, verifyModelProof, CompletionStatus } from "@/lib/codeIntake/proof";

export async function POST(req: NextRequest) {
  try {
    const { rawText, owner, repo, branch, githubToken, knownFilePaths, projectId, modelProof, acknowledgeUnknown } = (await req.json()) as {
      rawText: string;
      owner: string;
      repo: string;
      branch?: string;
      githubToken?: string;
      knownFilePaths?: string[];
      projectId?: string;
      modelProof?: string | null;
      acknowledgeUnknown?: boolean;
    };

    if (!rawText || !owner || !repo) {
      return NextResponse.json(
        { error: "Faltan campos: rawText, owner, repo." },
        { status: 400 }
      );
    }

    let completion: CompletionStatus = "unknown";
    if (modelProof) completion = verifyModelProof(modelProof, rawText);
    if (completion === "truncated") {
      return NextResponse.json({ error: "Respuesta truncada: solicitá continuación. El reconocimiento manual no habilita este contenido." }, { status: 422 });
    }
    if (completion === "unknown" && acknowledgeUnknown !== true) {
      return NextResponse.json({ error: "Completitud desconocida: confirmá una revisión manual antes de resolver." }, { status: 422 });
    }
    const before = await getBranchHeadSha({ owner, repo, branch }, githubToken);
    const instructions = parseCodeIntake(rawText);
    const resolved = await resolveInstructions(
      { owner, repo, branch: before.branch },
      instructions,
      githubToken,
      knownFilePaths
    );

    const after = await getBranchHeadSha({ owner, repo, branch: before.branch }, githubToken);
    if (before.sha !== after.sha) {
      return NextResponse.json({ error: "El HEAD cambió durante la resolución; repetí el diff." }, { status: 409 });
    }
    const validFiles = resolved.filter((file) => !file.error).map((file) => ({ path: file.path, content: file.newContent }));
    if (!validFiles.length) {
      return NextResponse.json({ error: "No hay operaciones válidas para confirmar." }, { status: 422 });
    }
    const resolutionProof = issueResolutionProof({ owner, repo, branch: after.branch, expectedHeadSha: after.sha, files: validFiles });

    // Un evento por archivo resuelto: PatchValidated si pasó el diff real
    // contra GitHub, PatchRejected si resolve.ts lo descartó (FIND que no
    // matchea, o el endurecimiento de ACTION: write contra colisión de
    // nombre — ver CONTEXT_BASE.md sección 22).
    for (const r of resolved) {
      await emitEvent({
        eventType: r.error ? "PatchRejected" : "PatchValidated",
        actor: "user",
        source: "System",
        projectId: projectId ?? null,
        entityId: `${owner}/${repo}`,
        payload: r.error
          ? { path: r.path, action: r.action, reason: r.error }
          : { path: r.path, action: r.action },
      });
    }

    return NextResponse.json({ resolved, resolutionProof, expectedHeadSha: after.sha, resolvedBranch: after.branch, completion });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
