import { getSupabaseServerClient } from "./supabase";
import { emitEvent } from "../events/emit";
import { getTask } from "./tasks";
import {
  getProjectRepository,
  linkSessionToWorkItem,
  OperationalIntegrityError,
} from "./operationalIntegrity";
import { getBranchHeadSha } from "../github/client";
import {
  CheckpointDeclaredState,
  CheckpointHandoff,
  CheckpointHandoffState,
  ResumeEvaluation,
  WorkCheckpoint,
  WorkItemSnapshot,
} from "../checkpoints/contracts";

export class CheckpointError extends OperationalIntegrityError {
  readonly checkpointId?: string;
  readonly handoffId?: string;
  readonly canonicalEventPersisted?: boolean;

  constructor(
    message: string,
    details?: {
      checkpointId?: string;
      handoffId?: string;
      canonicalEventPersisted?: boolean;
    }
  ) {
    super(message);
    this.checkpointId = details?.checkpointId;
    this.handoffId = details?.handoffId;
    this.canonicalEventPersisted = details?.canonicalEventPersisted;
  }
}

function taskSnapshot(task: Awaited<ReturnType<typeof getTask>>): WorkItemSnapshot {
  if (!task) throw new CheckpointError("El Work Item no existe.");
  return {
    id: task.id,
    title: task.title,
    objective: task.objective,
    acceptanceCriteria: task.acceptance_criteria,
    status: task.status,
  };
}

function sameInstant(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime();
}

async function assertSessionBelongsToProject(sessionId: string, projectId: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, project_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new CheckpointError(`Session ${sessionId} no existe.`);
  if (data.project_id !== projectId) {
    throw new CheckpointError("La Session pertenece a otro proyecto.");
  }
}

async function assertSourceSessionLinked(
  sessionId: string,
  workItemId: string,
  projectId: string
) {
  await assertSessionBelongsToProject(sessionId, projectId);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_item_session_links")
    .select("id")
    .eq("project_id", projectId)
    .eq("work_item_id", workItemId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new CheckpointError(
      "La Session origen no está vinculada al Work Item; no puede producir un checkpoint de ese trabajo."
    );
  }
}

async function validateEvidenceIds(
  evidenceIds: string[],
  projectId: string,
  workItemId: string
): Promise<string[]> {
  const unique = [...new Set(evidenceIds)];
  if (unique.length === 0) return [];

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("evidence_records")
    .select("id, project_id, work_item_id")
    .in("id", unique);

  if (error) throw error;
  if ((data ?? []).length !== unique.length) {
    throw new CheckpointError("Uno o más evidenceIds no existen.");
  }

  for (const row of data ?? []) {
    if (row.project_id !== projectId || row.work_item_id !== workItemId) {
      throw new CheckpointError(
        "Toda Evidence ligada al checkpoint debe pertenecer al mismo proyecto y Work Item."
      );
    }
  }

  return unique;
}

async function getCheckpointEvidenceIds(checkpointId: string): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("checkpoint_evidence_links")
    .select("evidence_id")
    .eq("checkpoint_id", checkpointId)
    .order("linked_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => row.evidence_id as string);
}

export async function getCheckpoint(checkpointId: string): Promise<WorkCheckpoint | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_checkpoints")
    .select("*")
    .eq("id", checkpointId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...(data as Omit<WorkCheckpoint, "evidenceIds">),
    evidenceIds: await getCheckpointEvidenceIds(checkpointId),
  };
}

export async function listCheckpointsForWorkItem(
  workItemId: string,
  limit = 20
): Promise<WorkCheckpoint[]> {
  const supabase = getSupabaseServerClient();
  const boundedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const { data, error } = await supabase
    .from("work_checkpoints")
    .select("*")
    .eq("work_item_id", workItemId)
    .order("created_at", { ascending: false })
    .limit(boundedLimit);

  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (row) => ({
      ...(row as Omit<WorkCheckpoint, "evidenceIds">),
      evidenceIds: await getCheckpointEvidenceIds(row.id as string),
    }))
  );
}

interface CanonicalCheckpointPayload {
  checkpointId: string;
  projectId: string;
  workItemId: string;
  sourceSessionId: string;
  workItemUpdatedAt: string;
  workItemSnapshot: WorkItemSnapshot;
  repoOwner: string;
  repoName: string;
  branch: string;
  repoHeadSha: string;
  declaredState: CheckpointDeclaredState;
  evidenceIds: string[];
  createdBy: "user" | "system";
  createdAt: string;
  version: number;
}

function checkpointPayloadFromEvent(payload: unknown): CanonicalCheckpointPayload {
  const p = (payload ?? {}) as Partial<CanonicalCheckpointPayload>;
  if (
    !p.checkpointId ||
    !p.projectId ||
    !p.workItemId ||
    !p.sourceSessionId ||
    !p.workItemUpdatedAt ||
    !p.workItemSnapshot ||
    !p.repoOwner ||
    !p.repoName ||
    !p.branch ||
    !p.repoHeadSha ||
    !p.declaredState ||
    !p.createdAt
  ) {
    throw new CheckpointError("WorkCheckpointCreated existe pero su payload canónico es incompleto.");
  }

  return {
    checkpointId: p.checkpointId,
    projectId: p.projectId,
    workItemId: p.workItemId,
    sourceSessionId: p.sourceSessionId,
    workItemUpdatedAt: p.workItemUpdatedAt,
    workItemSnapshot: p.workItemSnapshot,
    repoOwner: p.repoOwner,
    repoName: p.repoName,
    branch: p.branch,
    repoHeadSha: p.repoHeadSha,
    declaredState: p.declaredState,
    evidenceIds: Array.isArray(p.evidenceIds) ? p.evidenceIds : [],
    createdBy: p.createdBy === "system" ? "system" : "user",
    createdAt: p.createdAt,
    version: p.version ?? 1,
  };
}

async function materializeCheckpoint(payload: CanonicalCheckpointPayload): Promise<WorkCheckpoint> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("work_checkpoints")
    .upsert(
      {
        id: payload.checkpointId,
        project_id: payload.projectId,
        work_item_id: payload.workItemId,
        source_session_id: payload.sourceSessionId,
        work_item_updated_at: payload.workItemUpdatedAt,
        work_item_snapshot: payload.workItemSnapshot,
        repo_owner: payload.repoOwner,
        repo_name: payload.repoName,
        branch: payload.branch,
        repo_head_sha: payload.repoHeadSha,
        declared_state: payload.declaredState,
        created_by: payload.createdBy,
        created_at: payload.createdAt,
        version: payload.version,
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) {
    throw new CheckpointError(
      "WorkCheckpointCreated quedó durable en Event Log, pero falló su proyección materializada.",
      {
        checkpointId: payload.checkpointId,
        canonicalEventPersisted: true,
      }
    );
  }

  if (payload.evidenceIds.length > 0) {
    const { error: linkError } = await supabase
      .from("checkpoint_evidence_links")
      .upsert(
        payload.evidenceIds.map((evidenceId) => ({
          checkpoint_id: payload.checkpointId,
          evidence_id: evidenceId,
          linked_at: payload.createdAt,
        })),
        { onConflict: "checkpoint_id,evidence_id" }
      );

    if (linkError) {
      throw new CheckpointError(
        "El checkpoint quedó durable, pero falló la proyección de sus vínculos de Evidence.",
        {
          checkpointId: payload.checkpointId,
          canonicalEventPersisted: true,
        }
      );
    }
  }

  return {
    ...(data as Omit<WorkCheckpoint, "evidenceIds">),
    evidenceIds: payload.evidenceIds,
  };
}

export async function createWorkCheckpoint(params: {
  projectId: string;
  workItemId: string;
  sourceSessionId: string;
  declaredState: CheckpointDeclaredState;
  evidenceIds?: string[];
  branch?: string;
  githubToken?: string;
  createdBy?: "user" | "system";
  checkpointId?: string;
}): Promise<{ checkpoint: WorkCheckpoint; repairedProjection: boolean }> {
  const checkpointId = params.checkpointId ?? crypto.randomUUID();
  const existing = await getCheckpoint(checkpointId);

  if (existing) {
    if (
      existing.project_id !== params.projectId ||
      existing.work_item_id !== params.workItemId
    ) {
      throw new CheckpointError("checkpointId ya pertenece a otro Work Item.", {
        checkpointId,
      });
    }
    return { checkpoint: existing, repairedProjection: false };
  }

  const supabase = getSupabaseServerClient();

  // If a previous attempt persisted the Tier A event but projection failed,
  // the event payload is canonical and is used to repair the projection.
  const { data: priorEvent, error: priorEventError } = await supabase
    .from("events")
    .select("payload")
    .eq("project_id", params.projectId)
    .eq("entity_id", params.workItemId)
    .eq("event_type", "WorkCheckpointCreated")
    .contains("payload", { checkpointId })
    .limit(1)
    .maybeSingle();

  if (priorEventError) throw priorEventError;
  if (priorEvent) {
    const canonical = checkpointPayloadFromEvent(priorEvent.payload);
    if (
      canonical.projectId !== params.projectId ||
      canonical.workItemId !== params.workItemId
    ) {
      throw new CheckpointError(
        "El evento canónico no coincide con el proyecto/Work Item solicitado.",
        {
          checkpointId,
          canonicalEventPersisted: true,
        }
      );
    }
    return {
      checkpoint: await materializeCheckpoint(canonical),
      repairedProjection: true,
    };
  }

  const task = await getTask(params.workItemId);
  if (!task) throw new CheckpointError(`Work Item ${params.workItemId} no existe.`);
  if (task.project_id !== params.projectId) {
    throw new CheckpointError("El Work Item pertenece a otro proyecto.");
  }

  await assertSourceSessionLinked(
    params.sourceSessionId,
    params.workItemId,
    params.projectId
  );

  const evidenceIds = await validateEvidenceIds(
    params.evidenceIds ?? [],
    params.projectId,
    params.workItemId
  );

  const repo = await getProjectRepository(params.projectId);
  const observed = await getBranchHeadSha(
    {
      owner: repo.owner,
      repo: repo.repo,
      branch: params.branch?.trim() || repo.defaultBranch,
    },
    params.githubToken
  );

  const createdAt = new Date().toISOString();
  const canonical: CanonicalCheckpointPayload = {
    checkpointId,
    projectId: params.projectId,
    workItemId: task.id,
    sourceSessionId: params.sourceSessionId,
    workItemUpdatedAt: task.updated_at,
    workItemSnapshot: taskSnapshot(task),
    repoOwner: repo.owner,
    repoName: repo.repo,
    branch: observed.branch,
    repoHeadSha: observed.sha,
    declaredState: params.declaredState,
    evidenceIds,
    createdBy: params.createdBy ?? "user",
    createdAt,
    version: 1,
  };

  const logged = await emitEvent({
    eventType: "WorkCheckpointCreated",
    actor: canonical.createdBy,
    source: canonical.createdBy === "system" ? "System" : "user",
    projectId: params.projectId,
    entityId: params.workItemId,
    timestamp: createdAt,
    payload: { ...canonical },
  });

  if (!logged) {
    throw new CheckpointError(
      "No se pudo registrar WorkCheckpointCreated de forma durable — el checkpoint NO se creó.",
      { checkpointId, canonicalEventPersisted: false }
    );
  }

  return {
    checkpoint: await materializeCheckpoint(canonical),
    repairedProjection: false,
  };
}

interface CanonicalHandoffPayload {
  handoffId: string;
  checkpointId: string;
  workItemId: string;
  targetSessionId: string;
  state: CheckpointHandoffState;
  reasons: string[];
  checkpointRepoHeadSha: string;
  observedRepoHeadSha: string | null;
  checkpointWorkItemUpdatedAt: string;
  observedWorkItemUpdatedAt: string;
  verifier: string;
  evaluatedAt: string;
  version: number;
}

function handoffPayloadFromEvent(payload: unknown): CanonicalHandoffPayload {
  const p = (payload ?? {}) as Partial<CanonicalHandoffPayload>;
  if (
    !p.handoffId ||
    !p.checkpointId ||
    !p.workItemId ||
    !p.targetSessionId ||
    !p.state ||
    !Array.isArray(p.reasons) ||
    !p.checkpointRepoHeadSha ||
    !p.checkpointWorkItemUpdatedAt ||
    !p.observedWorkItemUpdatedAt ||
    !p.verifier ||
    !p.evaluatedAt
  ) {
    throw new CheckpointError("WorkHandoffEvaluated existe pero su payload canónico es incompleto.");
  }

  return {
    handoffId: p.handoffId,
    checkpointId: p.checkpointId,
    workItemId: p.workItemId,
    targetSessionId: p.targetSessionId,
    state: p.state,
    reasons: p.reasons,
    checkpointRepoHeadSha: p.checkpointRepoHeadSha,
    observedRepoHeadSha: p.observedRepoHeadSha ?? null,
    checkpointWorkItemUpdatedAt: p.checkpointWorkItemUpdatedAt,
    observedWorkItemUpdatedAt: p.observedWorkItemUpdatedAt,
    verifier: p.verifier,
    evaluatedAt: p.evaluatedAt,
    version: p.version ?? 1,
  };
}

async function materializeHandoff(
  projectId: string,
  payload: CanonicalHandoffPayload
): Promise<CheckpointHandoff> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("checkpoint_handoffs")
    .upsert(
      {
        id: payload.handoffId,
        project_id: projectId,
        work_item_id: payload.workItemId,
        checkpoint_id: payload.checkpointId,
        target_session_id: payload.targetSessionId,
        state: payload.state,
        reasons: payload.reasons,
        checkpoint_repo_head_sha: payload.checkpointRepoHeadSha,
        observed_repo_head_sha: payload.observedRepoHeadSha,
        checkpoint_work_item_updated_at: payload.checkpointWorkItemUpdatedAt,
        observed_work_item_updated_at: payload.observedWorkItemUpdatedAt,
        verifier: payload.verifier,
        evaluated_at: payload.evaluatedAt,
        version: payload.version,
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) {
    throw new CheckpointError(
      "WorkHandoffEvaluated quedó durable en Event Log, pero falló su proyección materializada.",
      {
        handoffId: payload.handoffId,
        canonicalEventPersisted: true,
      }
    );
  }

  return data as CheckpointHandoff;
}

export async function evaluateCheckpointForResume(params: {
  checkpointId: string;
  targetSessionId: string;
  githubToken?: string;
  handoffId?: string;
}): Promise<ResumeEvaluation & { repairedProjection: boolean }> {
  const checkpoint = await getCheckpoint(params.checkpointId);
  if (!checkpoint) {
    throw new CheckpointError(`Checkpoint ${params.checkpointId} no existe.`);
  }

  const handoffId = params.handoffId ?? crypto.randomUUID();
  const supabase = getSupabaseServerClient();

  const { data: existingHandoff, error: existingHandoffError } = await supabase
    .from("checkpoint_handoffs")
    .select("*")
    .eq("id", handoffId)
    .maybeSingle();

  if (existingHandoffError) throw existingHandoffError;
  if (existingHandoff) {
    if (existingHandoff.checkpoint_id !== checkpoint.id) {
      throw new CheckpointError("handoffId ya pertenece a otro checkpoint.", {
        handoffId,
      });
    }
    return {
      checkpoint,
      handoff: existingHandoff as CheckpointHandoff,
      stateMatchConfirmed: existingHandoff.state === "same_state",
      requiresStateRevalidation: existingHandoff.state !== "same_state",
      repairedProjection: false,
    };
  }

  const { data: priorEvent, error: priorEventError } = await supabase
    .from("events")
    .select("payload")
    .eq("project_id", checkpoint.project_id)
    .eq("entity_id", checkpoint.work_item_id)
    .eq("event_type", "WorkHandoffEvaluated")
    .contains("payload", { handoffId })
    .limit(1)
    .maybeSingle();

  if (priorEventError) throw priorEventError;
  if (priorEvent) {
    const canonical = handoffPayloadFromEvent(priorEvent.payload);
    if (
      canonical.checkpointId !== checkpoint.id ||
      canonical.workItemId !== checkpoint.work_item_id
    ) {
      throw new CheckpointError(
        "El evento canónico de handoff no coincide con el checkpoint solicitado.",
        {
          handoffId,
          canonicalEventPersisted: true,
        }
      );
    }
    return {
      checkpoint,
      handoff: await materializeHandoff(checkpoint.project_id, canonical),
      stateMatchConfirmed: canonical.state === "same_state",
      requiresStateRevalidation: canonical.state !== "same_state",
      repairedProjection: true,
    };
  }

  await assertSessionBelongsToProject(params.targetSessionId, checkpoint.project_id);
  await linkSessionToWorkItem({
    projectId: checkpoint.project_id,
    workItemId: checkpoint.work_item_id,
    sessionId: params.targetSessionId,
    linkedBy: "system",
  });

  const task = await getTask(checkpoint.work_item_id);
  if (!task) {
    throw new CheckpointError("El Work Item del checkpoint ya no existe.");
  }

  const reasons: string[] = [];
  if (!sameInstant(task.updated_at, checkpoint.work_item_updated_at)) {
    reasons.push("work_item_changed");
  }

  const currentRepo = await getProjectRepository(checkpoint.project_id);
  const repositoryChanged =
    currentRepo.owner !== checkpoint.repo_owner ||
    currentRepo.repo !== checkpoint.repo_name;

  let observedRepoHeadSha: string | null = null;
  let repoObservationUnknown = false;

  if (repositoryChanged) {
    reasons.push("repository_changed");
  } else {
    try {
      const observed = await getBranchHeadSha(
        {
          owner: checkpoint.repo_owner,
          repo: checkpoint.repo_name,
          branch: checkpoint.branch,
        },
        params.githubToken
      );
      observedRepoHeadSha = observed.sha;
      if (observed.sha !== checkpoint.repo_head_sha) {
        reasons.push("repo_head_changed");
      }
    } catch (err) {
      repoObservationUnknown = true;
      reasons.push("repo_head_unavailable");
      console.error(
        "[checkpoint] No se pudo observar HEAD durante resume:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const knownChanged = reasons.some((reason) =>
    ["work_item_changed", "repository_changed", "repo_head_changed"].includes(reason)
  );

  const state: CheckpointHandoffState = knownChanged
    ? "changed_state"
    : repoObservationUnknown
      ? "unknown"
      : "same_state";

  const evaluatedAt = new Date().toISOString();
  const canonical: CanonicalHandoffPayload = {
    handoffId,
    checkpointId: checkpoint.id,
    workItemId: checkpoint.work_item_id,
    targetSessionId: params.targetSessionId,
    state,
    reasons,
    checkpointRepoHeadSha: checkpoint.repo_head_sha,
    observedRepoHeadSha,
    checkpointWorkItemUpdatedAt: checkpoint.work_item_updated_at,
    observedWorkItemUpdatedAt: task.updated_at,
    verifier: repositoryChanged
      ? "project.repository-identity + task.updated_at"
      : "github.git.getRef + task.updated_at",
    evaluatedAt,
    version: 1,
  };

  const logged = await emitEvent({
    eventType: "WorkHandoffEvaluated",
    actor: "system",
    source: "System",
    projectId: checkpoint.project_id,
    entityId: checkpoint.work_item_id,
    timestamp: evaluatedAt,
    payload: { ...canonical },
  });

  if (!logged) {
    throw new CheckpointError(
      "No se pudo registrar WorkHandoffEvaluated de forma durable — la evaluación NO se materializó.",
      { handoffId, canonicalEventPersisted: false }
    );
  }

  const handoff = await materializeHandoff(checkpoint.project_id, canonical);

  return {
    checkpoint,
    handoff,
    stateMatchConfirmed: state === "same_state",
    requiresStateRevalidation: state !== "same_state",
    repairedProjection: false,
  };
}
