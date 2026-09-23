import { NextRequest, NextResponse } from "next/server";
import {
  linkSessionToWorkItem,
  OperationalIntegrityError,
} from "@/lib/db/operationalIntegrity";
import { getErrorMessage } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const { projectId, workItemId, sessionId, linkedBy } = (await req.json()) as {
      projectId: string;
      workItemId: string;
      sessionId: string;
      linkedBy?: "user" | "system";
    };

    if (!projectId || !workItemId || !sessionId) {
      return NextResponse.json(
        { error: "Faltan projectId, workItemId o sessionId." },
        { status: 400 }
      );
    }

    const link = await linkSessionToWorkItem({
      projectId,
      workItemId,
      sessionId,
      linkedBy,
    });

    return NextResponse.json({ link });
  } catch (err: unknown) {
    const status = err instanceof OperationalIntegrityError ? 409 : 500;
    return NextResponse.json({ error: getErrorMessage(err) }, { status });
  }
}
