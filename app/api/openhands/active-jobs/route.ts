import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

/**
 * Usada por scripts/openhands-relay.js (corre en la PC del usuario, junto
 * a OpenHands) para saber qué conversation_id están activos y hay que
 * pollear. Requiere el mismo secreto que el webhook, por las dudas de que
 * esta URL quede expuesta.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const expectedSecret = process.env.OPENHANDS_WEBHOOK_SECRET;
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("agent_jobs")
      .select("id, openhands_conversation_id, status")
      .in("status", ["queued", "running"])
      .not("openhands_conversation_id", "is", null);

    if (error) throw error;

    return NextResponse.json({ jobs: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
