import { getSupabaseServerClient } from "../db/supabase";

/**
 * Sprint 1 — Event Log (CONTEXT_BASE.md sección 24, canon en
 * Sprint0_Event_Canon.md). Append-only, envelope común. Este helper es la
 * ÚNICA forma de escribir en la tabla `events` — nada más debería insertar
 * ahí directo.
 *
 * Regla de falla: emitir un evento NUNCA debe romper la acción real que
 * está instrumentando. Si el insert falla (red, Supabase pausado, etc.),
 * se loguea y se sigue — el llamador nunca ve una excepción de acá.
 */

export type EventSource = "user" | "Claude" | "NIM" | "GPT" | "OpenHands" | "GitHub" | "System";
export type EventActor = "user" | "system";

export interface EmitEventParams {
  eventType: string;
  actor: EventActor;
  source: EventSource;
  projectId?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  version?: number;
}

export async function emitEvent(params: EmitEventParams): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("events").insert({
      project_id: params.projectId ?? null,
      entity_id: params.entityId ?? null,
      event_type: params.eventType,
      actor: params.actor,
      source: params.source,
      version: params.version ?? 1,
      payload: params.payload ?? {},
    });
    if (error) {
      console.error(`[events] Error emitiendo ${params.eventType}:`, error.message);
    }
  } catch (err) {
    console.error(
      `[events] Excepción emitiendo ${params.eventType}:`,
      err instanceof Error ? err.message : err
    );
  }
}

/** Mapea el id interno de proveedor al `source` del canon. */
export function providerToSource(providerId: string): EventSource {
  switch (providerId) {
    case "nvidia":
      return "NIM";
    case "anthropic":
      return "Claude";
    case "openai":
      return "GPT";
    default:
      return "System";
  }
}
