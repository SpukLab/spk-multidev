import { NextRequest, NextResponse } from "next/server";
import {
  CheckpointError,
  createWorkCheckpoint,
  listCheckpointsForWorkItem,
} from "@/lib/db/checkpoints";
import { getErrorMessage } from "@/lib/errors";

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === "string")) return null;
  return value.map((item) => item.trim()).filter(Boolean);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rawLimit = req.nextUrl.searchParams.get("limit");
    const limit = rawLimit ? Number(rawLimit) : 20;
    const checkpoints = await listCheckpointsForWorkItem(
      params.id,
      Number.isFinite(limit) ? limit : 20
    );
    return NextResponse.json({ checkpoints });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const sourceSessionId =
      typeof body.sourceSessionId === "string" ? body.sourceSessionId : "";
    const nextAction =
      typeof body.nextAction === "string" ? body.nextAction.trim() : "";

    const completed = stringArray(body.completed);
    const modifiedFiles = stringArray(body.modifiedFiles);
    const failedAttempts = stringArray(body.failedAttempts);
    const blockers = stringArray(body.blockers);
    const pendingDecisions = stringArray(body.pendingDecisions);
    const evidenceIds = stringArray(body.evidenceIds ?? []);

    if (
      !projectId ||
      !sourceSessionId ||
      !nextAction ||
      completed === null ||
      modifiedFiles === null ||
      failedAttempts === null ||
      blockers === null ||
      pendingDecisions === null ||
      evidenceIds === null
    ) {
      return NextResponse.json(
        {
          error:
            "Payload inválido. Se requieren projectId, sourceSessionId, nextAction y arrays de strings para completed/modifiedFiles/failedAttempts/blockers/pendingDecisions/evidenceIds.",
        },
        { status: 400 }
      );
    }

    const result = await createWorkCheckpoint({
      projectId,
      workItemId: params.id,
      sourceSessionId,
      declaredState: {
        completed,
        modifiedFiles,
        failedAttempts,
        blockers,
        pendingDecisions,
        nextAction,
        notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      },
      evidenceIds,
      branch: typeof body.branch === "string" ? body.branch : undefined,
      githubToken:
        typeof body.githubToken === "string" ? body.githubToken : undefined,
      checkpointId:
        typeof body.checkpointId === "string" ? body.checkpointId : undefined,
      createdBy: "user",
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const isCheckpointError = err instanceof CheckpointError;
    return NextResponse.json(
      {
        error: getErrorMessage(err),
        ...(isCheckpointError
          ? {
              checkpointId: err.checkpointId ?? null,
              canonicalEventPersisted:
                err.canonicalEventPersisted ?? null,
            }
          : {}),
      },
      { status: isCheckpointError ? 409 : 500 }
    );
  }
}
