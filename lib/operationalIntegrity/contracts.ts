/**
 * ADR-010 operational integrity contracts.
 *
 * These types deliberately preserve distinctions that are easy to collapse:
 * Work Item != Session != Memory
 * Control defined != control executed != control passed
 * Evidence != trusted evidence
 * Local validity != integrated validity
 */

export type ControlOutcome = "pass" | "fail" | "error" | "unknown";
export type EvidenceResult =
  | "pass"
  | "fail"
  | "unknown"
  | "partial"
  | "not_observed"
  | "observed";

export type VerifierRelation =
  | "external_authoritative"
  | "independent"
  | "shared_control"
  | "subject_controlled"
  | "unknown";

export interface WorkItemSessionLink {
  id: string;
  project_id: string;
  work_item_id: string;
  session_id: string;
  linked_by: string;
  linked_at: string;
}

export interface ControlDefinition {
  id: string;
  project_id: string;
  control_key: string;
  name: string;
  mechanism: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ControlRun {
  id: string;
  control_definition_id: string;
  project_id: string;
  work_item_id: string | null;
  session_id: string | null;
  subject_kind: string;
  subject_id: string;
  subject_version: string | null;
  executed_at: string;
  outcome: ControlOutcome;
  executor: string;
  environment: Record<string, unknown>;
  configuration: Record<string, unknown>;
  artifact_ref: string | null;
  created_at: string;
}

export interface EvidenceRecord {
  id: string;
  project_id: string;
  work_item_id: string | null;
  session_id: string | null;
  control_run_id: string | null;
  claim: string;
  subject_kind: string;
  subject_id: string;
  subject_version: string | null;
  source: string;
  observed_at: string;
  environment: Record<string, unknown>;
  configuration: Record<string, unknown>;
  verifier: string;
  verifier_relation: VerifierRelation;
  result: EvidenceResult;
  artifact_ref: string | null;
  coverage: Record<string, unknown> | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface OperationalIntegritySnapshot {
  workItem: {
    id: string;
    projectId: string;
    title: string;
    objective: string | null;
    acceptanceCriteria: string | null;
    status: string;
  };
  sessions: Array<{
    id: string;
    updatedAt: string;
  }>;
  controls: {
    defined: ControlDefinition[];
    executed: ControlRun[];
  };
  evidence: EvidenceRecord[];
}
