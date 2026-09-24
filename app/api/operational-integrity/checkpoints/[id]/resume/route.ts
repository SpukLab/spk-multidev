import { NextRequest, NextResponse } from "next/server";
import {
  CheckpointError,
  evaluateCheckpointForResume,
} from "@/lib/db/checkpoints";
import { getErrorMessage } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const targetSessionId =
      typeof body.targetSessionId === "string" ? body.targetSessionId : "";

    if (!targetSessionId) {
      return NextResponse.json(
        { error: "Falta targetSessionId." },
        { status: 400 }
      );
    }

    const result = await evaluateCheckpointForResume({
      checkpointId: params.id,
      targetSessionId,
      githubToken:
        typeof body.githubToken === "string" ? body.githubToken : undefined,
      handoffId:
        typeof body.handoffId === "string" ? body.handoffId : undefined,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const isCheckpointError = err instanceof CheckpointError;
    return NextResponse.json(
      {
        error: getErrorMessage(err),
        ...(isCheckpointError
          ? {
              checkpointId: err.checkpointId ?? null,
              handoffId: err.handoffId ?? null,
              canonicalEventPersisted:
                err.canonicalEventPersisted ?? null,
            }
          : {}),
      },
      { status: isCheckpointError ? 409 : 500 }
    );
  }
}
