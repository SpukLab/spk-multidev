import { getSupabaseServerClient } from "./supabase";
import { emitEvent } from "../events/emit";

/**
 * Sprint 3 — Knowledge Layer MVP (CONTEXT_BASE.md sección 29).
 *
 * Mismo principio que Task (sección 28): `knowledge_items` es una
 * proyección, nunca la fuente de verdad. La fuente de verdad son los
 * eventos Tier A (KnowledgeCaptured, KnowledgePromoted, KnowledgeRejected).
 *
 * Por qué Tier A y no Tier B: a diferencia de Development/Execution
 * (GitHub, agent_jobs como respaldo externo independiente), Knowledge no
 * tiene NINGÚN sistema externo de respaldo — existe únicamente acá. Mismo
 * caso que Task.
 *
 * KnowledgeArchived NO se implementa — no está ratificado en el Event
 * Canon (sección 24 solo ratifica Captured/Promoted/Superseded/Rejected),
 * y este sprint tiene instrucción explícita de no inventar eventos en
 * silencio. El modelo de estados queda: captured → promoted | rejected.
 */

export type KnowledgeType =
  | "observation"
  | "insight"
  | "decision"
  | "hypothesis"
  | "experiment"
  | "pattern"
  | "adr_candidate"
  | "rejected_idea"
  | "open_question"
  | "implementation_note"
  | "temporary_note";

export type KnowledgeStatus = "captured" | "promoted" | "rejected";
export type KnowledgeConfidence = "low" | "medium" | "high";

export interface KnowledgeItem {
  id: string;
  project_id: string;
  task_id: string | null;
  session_id: string | null;
  source_message_id: string | null;
  source_event_id: string | null;
  type: KnowledgeType;
  title: string;
  content: string;
  status: KnowledgeStatus;
  confidence: KnowledgeConfidence | null;
  created_at: string;
  updated_at: string;
}

export class KnowledgeTransitionError extends Error {}

export async function captureKnowledge(params: {
  projectId: string;
  taskId?: string | null;
  sessionId?: string | null;
  sourceMessageId?: string | null;
  type: KnowledgeType;
  title: string;
  content: string;
  confidence?: KnowledgeConfidence;
}): Promise<KnowledgeItem> {
  const supabase = getSupabaseServerClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const logged = await emitEvent({
    eventType: "KnowledgeCaptured",
    actor: "user",
    source: "user",
    projectId: params.projectId,
    entityId: id,
    timestamp: now,
    payload: {
      type: params.type,
      title: params.title,
      taskId: params.taskId ?? null,
      sessionId: params.sessionId ?? null,
      sourceMessageId: params.sourceMessageId ?? null,
    },
  });

  if (!logged) {
    throw new KnowledgeTransitionError(
      "No se pudo registrar el evento KnowledgeCaptured de forma durable — no se guardó el conocimiento."
    );
  }

  const { data, error } = await supabase
    .from("knowledge_items")
    .insert({
      id,
      project_id: params.projectId,
      task_id: params.taskId ?? null,
      session_id: params.sessionId ?? null,
      source_message_id: params.sourceMessageId ?? null,
      type: params.type,
      title: params.title,
      content: params.content,
      status: "captured",
      confidence: params.confidence ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw error;
  return data as KnowledgeItem;
}

export async function getKnowledgeItem(id: string): Promise<KnowledgeItem | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("knowledge_items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as KnowledgeItem | null;
}

export async function listKnowledgeForProject(
  projectId: string,
  filters?: { type?: KnowledgeType; status?: KnowledgeStatus }
): Promise<KnowledgeItem[]> {
  const supabase = getSupabaseServerClient();
  let query = supabase.from("knowledge_items").select("*").eq("project_id", projectId);
  if (filters?.type) query = query.eq("type", filters.type);
  if (filters?.status) query = query.eq("status", filters.status);
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as KnowledgeItem[];
}

/**
 * Promover o rechazar — únicas transiciones humanas posibles en Sprint 3.
 * El modelo NUNCA llama esta función por su cuenta; siempre requiere una
 * acción explícita del usuario en la UI.
 */
export async function transitionKnowledge(
  id: string,
  toStatus: "promoted" | "rejected"
): Promise<KnowledgeItem> {
  const supabase = getSupabaseServerClient();
  const current = await getKnowledgeItem(id);
  if (!current) {
    throw new KnowledgeTransitionError(`Knowledge ${id} no existe.`);
  }
  if (current.status !== "captured") {
    throw new KnowledgeTransitionError(
      `Solo se puede promover/rechazar conocimiento en estado "captured". Estado actual: ${current.status}.`
    );
  }

  const eventType = toStatus === "promoted" ? "KnowledgePromoted" : "KnowledgeRejected";
  const now = new Date().toISOString();

  const logged = await emitEvent({
    eventType,
    actor: "user",
    source: "user",
    projectId: current.project_id,
    entityId: id,
    timestamp: now,
    payload: { field: "status", from: current.status, to: toStatus },
  });

  if (!logged) {
    throw new KnowledgeTransitionError(
      `No se pudo registrar el evento ${eventType} de forma durable — la transición NO se aplicó.`
    );
  }

  const { data, error } = await supabase
    .from("knowledge_items")
    .update({ status: toStatus, updated_at: now })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as KnowledgeItem;
}

export async function getKnowledgeEventHistory(id: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("event_type, timestamp, payload, actor, source")
    .eq("entity_id", id)
    .order("timestamp", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
