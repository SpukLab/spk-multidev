import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import { getErrorMessage } from "@/lib/errors";

/**
 * Sprint 4, commit 5/6 — ADR-011 (CONTEXT_BASE.md sección 30).
 *
 * Trae el último evento ContextBuilt (ya ratificado, sección 24) para
 * una sesión/panel puntual — responde "qué se armó y por qué" leyendo
 * directo del Event Log, sin ningún subsistema nuevo.
 */
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    const panelId = req.nextUrl.searchParams.get("panelId");
    if (!sessionId) {
      return NextResponse.json({ error: "Falta sessionId." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("events")
      .select("payload, timestamp")
      .eq("event_type", "ContextBuilt")
      .eq("entity_id", sessionId)
      .order("timestamp", { ascending: false })
      .limit(50); // margen para filtrar por panel en memoria y quedarnos con 10 reales

    if (error) throw error;

    const filtered = panelId ? (data ?? []).filter((d) => d.payload?.panelId === panelId) : data ?? [];
    return NextResponse.json({ history: filtered.slice(0, 10) });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
