import { NextRequest, NextResponse } from "next/server";
import { evaluatePermissionDirectives } from "@/lib/db/authority";
import { getErrorMessage } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const { projectId, grantee, action, resourceScope, at } = (await req.json()) as {
      projectId: string;
      grantee: string;
      action: string;
      resourceScope: string;
      at?: string;
    };

    if (!projectId || !grantee?.trim() || !action?.trim() || !resourceScope?.trim()) {
      return NextResponse.json(
        { error: "Faltan projectId, grantee, action o resourceScope." },
        { status: 400 }
      );
    }

    const evaluation = await evaluatePermissionDirectives({
      projectId,
      grantee: grantee.trim(),
      action: action.trim(),
      resourceScope: resourceScope.trim(),
      at,
    });

    return NextResponse.json({
      ...evaluation,
      exactScope: true,
      precedenceApplied: false,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
