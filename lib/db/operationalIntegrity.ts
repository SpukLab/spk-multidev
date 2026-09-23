import { getSupabaseServerClient } from "./supabase";
import { emitEvent } from "../events/emit";
import { getTask } from "./tasks";
import {
  ControlDefinition,
  ControlOutcome,
  ControlRun,
  EvidenceRecord,
  EvidenceResult,
  OperationalIntegritySnapshot,
  VerifierRelation,
  WorkItemSessionLink,
} from "../operationalIntegrity/contracts";

export class OperationalIntegrityError extends Error {}

export class WorkItemSessionProjectionError extends OperationalIntegrityError {
  readonly canonicalEventPersisted = true;
}

export async function getProjectRepository(projectId: string): Promise<{
  owner: string;
  repo: string;
  defaultBranch: string;
}> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("github_owner, github_repo, default_branch")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new OperationalIntegrityError(`Proyecto ${projectId} no existe.`);

  return {
    owner: data.github_owner as string,
    repo: data.github_repo as string,
    defaultBranch: data.default_branch as string,
  };
}

async function assertWorkItemProject(workItemId: string, projectId: string) {
  const task = await getTask(workItemId);
  if (!task) throw new OperationalIntegrityError(`Work Item ${workItemId} no existe.`);
  if (task.project_id !== projectId) {
    throw new OperationalIntegrityError("El Work Item pertenece a otro proyecto.");
  }
  return task;
}

async function assertSessionProject(sessionId: string, projectId: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, project_id, updated_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new OperationalIntegrityError(`Session ${sessionId} no existe.`);
  if (data.project_id !== projectId) {
    throw new OperationalIntegrityError("La Session pertenece a otro proyecto.");
  }
  return data as { id: string; project_id: string; updated_at: string };
}

/**
 * Pilot mapping: the existing Task is the current implementation of a Work Item.
 * The relation is explicit so a Work Item can outlive and span multiple Sessions.
 *
 * The event is Tier A for this relation: if it cannot be persisted, the link
 * projection is not created.
 */
export async function linkSessionToWorkItem(params: {
  projectId: string;
  workItemId: string;
  sessionId: string;
  linkedBy?: "user" | "system";
}): Promise<WorkItemSessionLink> {
  await assertWorkItemProject(params.workItemId, params.projectId);
  await assertSessionProject(params.sessionId, params.projectId);

  const supabase = getSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("work_item_session_links")
    .select("*")
    .eq("work_item_id", params.workItemId)
    .eq("session_id", params.sessionId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as WorkItemSessionLink;

  // Event Log is the source of truth. If a previous attempt persisted the
  // canonical event but failed to materialize the projection, repair the
  // projection without emitting a duplicate event.
  const { data: priorEvent, error: priorEventError } = await supabase
    .from("events")
    .select("timestamp, payload")
    .eq("project_id", params.projectId)
    .eq("entity_id", params.workItemId)
    .eq("event_type", "WorkItemSessionLinked")
    .contains("payload", { sessionId: params.sessionId })
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (priorEventError) throw priorEventError;

  let linkedAt: string;
  let linkedBy: "user" | "system";

  if (priorEvent) {
    const payload = (priorEvent.payload ?? {}) as Record<string, unknown>;
    linkedAt = priorEvent.timestamp as string;
    linkedBy = payload.linkedBy === "system" ? "system" : "user";
  } else {
    linkedAt = new Date().toISOString();
    linkedBy = params.linkedBy ?? "user";

    const logged = await emitEvent({
      eventType: "WorkItemSessionLinked",
      actor: linkedBy === "system" ? "system" : "user",
      source: linkedBy === "system" ? "System" : "user",
      projectId: params.projectId,
      entityId: params.workItemId,
      timestamp: linkedAt,
      payload: {
        workItemId: params.workItemId,
        sessionId: params.sessionId,
        linkedBy,
      },
    });

    if (!logged) {
      throw new OperationalIntegrityError(
        "No se pudo persistir WorkItemSessionLinked — la relación Work Item/Session NO se creó."
      );
    }
  }

  const { data, error } = await supabase
    .from("work_item_session_links")
    .upsert(
      {
        project_id: params.projectId,
        work_item_id: params.workItemId,
        session_id: params.sessionId,
        linked_by: linkedBy,
        linked_at: linkedAt,
      },
      { onConflict: "work_item_id,session_id" }
    )
    .select()
    .single();

  if (error) {
    // El evento canónico ya existe en este punto. No podemos decir que la
    // relación "no ocurrió"; sólo que su proyección materializada quedó
    // pendiente de reconstrucción.
    throw new WorkItemSessionProjectionError(
      "WorkItemSessionLinked quedó durable en Event Log, pero falló su proyección materializada."
    );
  }

  return data as WorkItemSessionLink;
}

export async function ensureControlDefinition(params: {
  projectId: string;
  controlKey: string;
  name: string;
  mechanism: string;
  description?: string;
}): Promise<ControlDefinition> {
  const supabase = getSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("control_definitions")
    .select("*")
    .eq("project_id", params.projectId)
    .eq("control_key", params.controlKey)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as ControlDefinition;

  const { data, error } = await supabase
    .from("control_definitions")
    .insert({
      project_id: params.projectId,
      control_key: params.controlKey,
      name: params.name,
      mechanism: params.mechanism,
      description: params.description ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ControlDefinition;
}

export async function recordControlRunWithEvidence(params: {
  control: ControlDefinition;
  projectId: string;
  workItemId?: string | null;
  sessionId?: string | null;
  subjectKind: string;
  subjectId: string;
  subjectVersion?: string | null;
  outcome: ControlOutcome;
  executor: string;
  environment?: Record<string, unknown>;
  configuration?: Record<string, unknown>;
  artifactRef?: string | null;
  claim: string;
  source: string;
  verifier: string;
  verifierRelation: VerifierRelation;
  evidenceResult?: EvidenceResult;
  evidencePayload?: Record<string, unknown>;
  coverage?: Record<string, unknown> | null;
  executedAt?: string;
}): Promise<{
  run: ControlRun;
  evidence: EvidenceRecord | null;
  evidencePersisted: boolean;
}> {
  if (params.control.project_id !== params.projectId) {
    throw new OperationalIntegrityError("La definición del control pertenece a otro proyecto.");
  }
  if (!params.control.is_active) {
    throw new OperationalIntegrityError("El control está desactivado.");
  }
  if (params.workItemId) await assertWorkItemProject(params.workItemId, params.projectId);
  if (params.sessionId) await assertSessionProject(params.sessionId, params.projectId);

  const supabase = getSupabaseServerClient();
  const executedAt = params.executedAt ?? new Date().toISOString();
  const environment = params.environment ?? {};
  const configuration = params.configuration ?? {};

  // CONTROL EXECUTED: this row is durable even if evidence persistence fails later.
  const { data: runData, error: runError } = await supabase
    .from("control_runs")
    .insert({
      control_definition_id: params.control.id,
      project_id: params.projectId,
      work_item_id: params.workItemId ?? null,
      session_id: params.sessionId ?? null,
      subject_kind: params.subjectKind,
      subject_id: params.subjectId,
      subject_version: params.subjectVersion ?? null,
      executed_at: executedAt,
      outcome: params.outcome,
      executor: params.executor,
      environment,
      configuration,
      artifact_ref: params.artifactRef ?? null,
    })
    .select()
    .single();

  if (runError) throw runError;
  const run = runData as ControlRun;

  // Evidence is a separate fact. If this insert fails we preserve the run and
  // report evidencePersisted=false instead of pretending the evidence exists.
  const evidenceResult: EvidenceResult =
    params.evidenceResult ?? (params.outcome === "error" ? "unknown" : params.outcome);

  const { data: evidenceData, error: evidenceError } = await supabase
    .from("evidence_records")
    .insert({
      project_id: params.projectId,
      work_item_id: params.workItemId ?? null,
      session_id: params.sessionId ?? null,
      control_run_id: run.id,
      claim: params.claim,
      subject_kind: params.subjectKind,
      subject_id: params.subjectId,
      subject_version: params.subjectVersion ?? null,
      source: params.source,
      observed_at: executedAt,
      environment,
      configuration,
      verifier: params.verifier,
      verifier_relation: params.verifierRelation,
      result: evidenceResult,
      artifact_ref: params.artifactRef ?? null,
      coverage: params.coverage ?? null,
      payload: params.evidencePayload ?? {},
    })
    .select()
    .single();

  if (evidenceError) {
    console.error(
      `[operational-integrity] Control ${params.control.control_key} ejecutó pero Evidence no persistió:`,
      evidenceError.message
    );
    return { run, evidence: null, evidencePersisted: false };
  }

  return {
    run,
    evidence: evidenceData as EvidenceRecord,
    evidencePersisted: true,
  };
}

export async function getOperationalIntegritySnapshot(
  workItemId: string
): Promise<OperationalIntegritySnapshot | null> {
  const task = await getTask(workItemId);
  if (!task) return null;

  const supabase = getSupabaseServerClient();

  const { data: links, error: linksError } = await supabase
    .from("work_item_session_links")
    .select("session_id")
    .eq("work_item_id", workItemId)
    .order("linked_at", { ascending: true });
  if (linksError) throw linksError;

  const sessionIds = (links ?? []).map((link) => link.session_id as string);
  let sessions: Array<{ id: string; updatedAt: string }> = [];

  if (sessionIds.length > 0) {
    const { data: sessionRows, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, updated_at")
      .in("id", sessionIds);
    if (sessionsError) throw sessionsError;
    sessions = (sessionRows ?? []).map((row) => ({
      id: row.id as string,
      updatedAt: row.updated_at as string,
    }));
  }

  const { data: definitions, error: definitionsError } = await supabase
    .from("control_definitions")
    .select("*")
    .eq("project_id", task.project_id)
    .order("created_at", { ascending: true });
  if (definitionsError) throw definitionsError;

  const { data: runs, error: runsError } = await supabase
    .from("control_runs")
    .select("*")
    .eq("work_item_id", workItemId)
    .order("executed_at", { ascending: false })
    .limit(50);
  if (runsError) throw runsError;

  const { data: evidence, error: evidenceError } = await supabase
    .from("evidence_records")
    .select("*")
    .eq("work_item_id", workItemId)
    .order("observed_at", { ascending: false })
    .limit(50);
  if (evidenceError) throw evidenceError;

  return {
    workItem: {
      id: task.id,
      projectId: task.project_id,
      title: task.title,
      objective: task.objective,
      acceptanceCriteria: task.acceptance_criteria,
      status: task.status,
    },
    sessions,
    controls: {
      defined: (definitions ?? []) as ControlDefinition[],
      executed: (runs ?? []) as ControlRun[],
    },
    evidence: (evidence ?? []) as EvidenceRecord[],
  };
}
