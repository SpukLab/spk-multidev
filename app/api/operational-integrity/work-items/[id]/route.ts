import { NextResponse } from "next/server";
import { getOperationalIntegritySnapshot } from "@/lib/db/operationalIntegrity";
import { getErrorMessage } from "@/lib/errors";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const snapshot = await getOperationalIntegritySnapshot(params.id);
    if (!snapshot) {
      return NextResponse.json({ error: "Work Item no encontrado." }, { status: 404 });
    }
    return NextResponse.json({ snapshot });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
