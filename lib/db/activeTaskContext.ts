import { getSupabaseServerClient } from "./supabase";
import { emitEvent } from "../events/emit";
import { getTask, Task } from "./tasks";

/**
 * Sprint 4 — ADR-011 (CONTEXT_BASE.md sección 30).
 *
 * La Task activa es una DECISIÓN OPERATIVA, no un dato estructural del
 * proyecto — por eso vive como evento Tier A (`ActiveTaskChanged`), nunca
 * como columna en `projects`. `active_project_context` es una proyección
 * mínima, igual de prescindible que `tasks`/`knowledge_items` — nunca la
 * fuente de verdad.
 */

export class ActiveTaskTransitionError extends Error {}

export async function setActiveTask(projectId: string, newTaskId: string | null): Promise<void> {
  const supabase = getSupabaseServerClient();

  // Si se está fijando una Task (no limpiando), validar que exista y
  // pertenezca a este proyecto — mismo criterio ya usado para la
  // vinculación Knowledge↔Task (CONTEXT_BASE §29, defecto 2).
  if (newTaskId) {
    const task = await getTask(newTaskId);
    if (!task) {
      throw new ActiveTaskTransitionError(`La Task ${newTaskId} no existe.`);
    }
    if (task.project_id !== projectId) {
      throw new ActiveTaskTransitionError(
        "La Task pertenece a otro proyecto — no se puede marcar como activa acá."
      );
    }
  }

  const { data: current } = await supabase
    .from("active_project_context")
    .select("active_task_id")
    .eq("project_id", projectId)
    .maybeSingle();

  const previousTaskId = current?.active_task_id ?? null;
  if (previousTaskId === newTaskId) return; // sin cambio real, no emitir evento vacío

  const now = new Date().toISOString();
  const logged = await emitEvent({
    eventType: "ActiveTaskChanged",
    actor: "user",
    source: "user",
    projectId,
    entityId: projectId, // la entidad que cambia de estado es el proyecto, no la Task
    timestamp: now,
    payload: { projectId, previousTaskId, newTaskId },
  });

  if (!logged) {
    throw new ActiveTaskTransitionError(
      "No se pudo registrar el evento ActiveTaskChanged de forma durable — la Task activa NO cambió."
    );
  }

  const { error } = await supabase
    .from("active_project_context")
    .upsert({ project_id: projectId, active_task_id: newTaskId, updated_at: now });
  if (error) throw error;
}

export async function getActiveTask(projectId: string): Promise<Task | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("active_project_context")
    .select("active_task_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.active_task_id) return null;
  return getTask(data.active_task_id);
}
