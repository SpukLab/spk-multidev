import { getSupabaseServerClient } from "./supabase";
import { emitEvent } from "../events/emit";

/**
 * Sprint 2 — Task como proyección (CONTEXT_BASE.md sección 27/28).
 *
 * PRINCIPIO CENTRAL: `tasks` es una proyección materializada, NUNCA la
 * fuente de verdad. La fuente de verdad son los eventos Tier A
 * (TaskCreated, TaskUpdated, TaskCompleted, TaskAbandoned) en `events`.
 *
 * Garantía Tier A: toda mutación acá sigue el mismo orden estricto —
 * 1) validar la transición, 2) persistir el evento y chequear su retorno,
 * 3) solo si el evento persistió, tocar la fila de `tasks`. Si el evento
 * falla, la función devuelve null/lanza y la proyección NUNCA se toca —
 * no hay "mejor esfuerzo" para transiciones de Task, a diferencia del
 * resto del canon.
 */

export type TaskStatus = "open" | "in_progress" | "completed" | "abandoned";

export interface Task {
  id: string;
  project_id: string;
  title: string;
  objective: string | null;
  acceptance_criteria: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  abandoned_at: string | null;
}

// Transiciones válidas — completed/abandoned son terminales, nada sale de ahí.
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  open: ["in_progress", "abandoned"],
  in_progress: ["open", "completed", "abandoned"],
  completed: [],
  abandoned: [],
};

export class TaskTransitionError extends Error {}

export async function createTask(params: {
  projectId: string;
  title: string;
  objective?: string;
  acceptanceCriteria?: string;
}): Promise<Task> {
  const supabase = getSupabaseServerClient();
  const taskId = crypto.randomUUID();

  // Paso 1 (implícito): "abrir una Task" no tiene estado previo que validar.
  // Paso 2: persistir el evento Tier A primero, chequear el retorno.
  const logged = await emitEvent({
    eventType: "TaskCreated",
    actor: "user",
    source: "user",
    projectId: params.projectId,
    entityId: taskId,
    payload: {
      title: params.title,
      objective: params.objective ?? null,
      acceptanceCriteria: params.acceptanceCriteria ?? null,
    },
  });

  if (!logged) {
    // Sin efecto externo irreversible que proteger acá (a diferencia de
    // RepoDeleted) — se puede, y se debe, rechazar la operación entera.
    throw new TaskTransitionError(
      "No se pudo registrar el evento TaskCreated de forma durable — la tarea no se creó."
    );
  }

  // Paso 3: recién ahora se toca la proyección.
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      id: taskId,
      project_id: params.projectId,
      title: params.title,
      objective: params.objective ?? null,
      acceptance_criteria: params.acceptanceCriteria ?? null,
      status: "open",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Task;
}

export async function getTask(taskId: string): Promise<Task | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (error) throw error;
  return data as Task | null;
}

export async function listTasksForProject(projectId: string): Promise<Task[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Task[];
}

/**
 * Cambia el estado de una Task. Elige el evento canónico correcto según
 * el destino (TaskCompleted/TaskAbandoned son terminales y tienen su
 * propio evento con nombre; cualquier otra transición usa TaskUpdated
 * genérico con payload factual — mismo patrón ratificado en el Event
 * Canon, sección 24).
 */
export async function transitionTask(taskId: string, toStatus: TaskStatus): Promise<Task> {
  const supabase = getSupabaseServerClient();
  const current = await getTask(taskId);
  if (!current) {
    throw new TaskTransitionError(`Task ${taskId} no existe.`);
  }

  const allowed = VALID_TRANSITIONS[current.status];
  if (!allowed.includes(toStatus)) {
    throw new TaskTransitionError(
      `Transición inválida: ${current.status} → ${toStatus}. Válidas desde ${current.status}: ${allowed.join(", ") || "ninguna (estado terminal)"}.`
    );
  }

  const eventType =
    toStatus === "completed" ? "TaskCompleted" : toStatus === "abandoned" ? "TaskAbandoned" : "TaskUpdated";

  const logged = await emitEvent({
    eventType,
    actor: "user",
    source: "user",
    projectId: current.project_id,
    entityId: taskId,
    payload: { field: "status", from: current.status, to: toStatus },
  });

  if (!logged) {
    throw new TaskTransitionError(
      `No se pudo registrar el evento ${eventType} de forma durable — la transición ${current.status} → ${toStatus} NO se aplicó.`
    );
  }

  const now = new Date().toISOString();
  const update: Partial<Task> = { status: toStatus, updated_at: now };
  if (toStatus === "completed") update.completed_at = now;
  if (toStatus === "abandoned") update.abandoned_at = now;

  const { data, error } = await supabase.from("tasks").update(update).eq("id", taskId).select().single();
  if (error) throw error;
  return data as Task;
}

/**
 * Reconstruye la proyección de una Task leyendo ÚNICAMENTE sus eventos,
 * en orden — la prueba de que `tasks` es prescindible y reconstruible,
 * no una fuente de verdad paralela (regla 4 del Event Canon).
 */
export async function rebuildTaskProjection(taskId: string): Promise<Task | null> {
  const supabase = getSupabaseServerClient();
  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .eq("entity_id", taskId)
    .in("event_type", ["TaskCreated", "TaskUpdated", "TaskCompleted", "TaskAbandoned"])
    .order("timestamp", { ascending: true });

  if (error) throw error;
  if (!events || events.length === 0) return null;

  let rebuilt: Task | null = null;
  for (const ev of events) {
    const payload = ev.payload as Record<string, unknown>;
    if (ev.event_type === "TaskCreated") {
      rebuilt = {
        id: taskId,
        project_id: ev.project_id,
        title: (payload.title as string) ?? "",
        objective: (payload.objective as string) ?? null,
        acceptance_criteria: (payload.acceptanceCriteria as string) ?? null,
        status: "open",
        created_at: ev.timestamp,
        updated_at: ev.timestamp,
        completed_at: null,
        abandoned_at: null,
      };
    } else if (rebuilt) {
      if (ev.event_type === "TaskUpdated" && payload.field === "status") {
        rebuilt.status = payload.to as TaskStatus;
        rebuilt.updated_at = ev.timestamp;
      } else if (ev.event_type === "TaskCompleted") {
        rebuilt.status = "completed";
        rebuilt.completed_at = ev.timestamp;
        rebuilt.updated_at = ev.timestamp;
      } else if (ev.event_type === "TaskAbandoned") {
        rebuilt.status = "abandoned";
        rebuilt.abandoned_at = ev.timestamp;
        rebuilt.updated_at = ev.timestamp;
      }
    }
  }

  if (!rebuilt) return null;

  // Sobrescribe la proyección con el resultado recalculado — esto es lo
  // que hace que `tasks` sea prescindible: si se corrompe o se borra por
  // completo, este mismo camino la repone desde cero.
  const { error: upsertError } = await supabase.from("tasks").upsert(rebuilt);
  if (upsertError) throw upsertError;

  return rebuilt;
}

export async function getTaskEventHistory(taskId: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("event_type, timestamp, payload, actor, source")
    .eq("entity_id", taskId)
    .order("timestamp", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
