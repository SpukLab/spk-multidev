export interface WorkItemSnapshot {
  id: string;
  title: string;
  objective: string | null;
  acceptanceCriteria: string | null;
  status: string;
}

export interface CheckpointDeclaredState {
  completed: string[];
  modifiedFiles: string[];
  failedAttempts: string[];
  blockers: string[];
  pendingDecisions: string[];
  nextAction: string;
  notes: string | null;
}

export interface WorkCheckpoint {
  id: string;
  project_id: string;
  work_item_id: string;
  source_session_id: string;
  work_item_updated_at: string;
  work_item_snapshot: WorkItemSnapshot;
  repo_owner: string;
  repo_name: string;
  branch: string;
  repo_head_sha: string;
  declared_state: CheckpointDeclaredState;
  created_by: "user" | "system";
  created_at: string;
  version: number;
  evidenceIds: string[];
}

export type CheckpointHandoffState =
  | "same_state"
  | "changed_state"
  | "unknown";

export interface CheckpointHandoff {
  id: string;
  project_id: string;
  work_item_id: string;
  checkpoint_id: string;
  target_session_id: string;
  state: CheckpointHandoffState;
  reasons: string[];
  checkpoint_repo_head_sha: string;
  observed_repo_head_sha: string | null;
  checkpoint_work_item_updated_at: string;
  observed_work_item_updated_at: string;
  verifier: string;
  evaluated_at: string;
  created_at: string;
  version: number;
}

export interface ResumeEvaluation {
  checkpoint: WorkCheckpoint;
  handoff: CheckpointHandoff;
  usableWithoutRevalidation: boolean;
}
