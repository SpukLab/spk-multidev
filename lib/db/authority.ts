import { getSupabaseServerClient } from "./supabase";

export type PermissionEvaluationState =
  | "unknown"
  | "allow"
  | "deny"
  | "authority_conflict";

export interface PermissionEvaluation {
  state: PermissionEvaluationState;
  allowCount: number;
  denyCount: number;
  activeCount: number;
  directiveIds: string[];
}

/**
 * Deterministic exact-scope permission evaluation.
 *
 * v1 deliberately does NOT resolve conflicting allow/deny directives through
 * numeric precedence. Precedence can be stored for provenance, but until a
 * legitimate precedence model exists, conflict remains explicit.
 */
export async function evaluatePermissionDirectives(params: {
  projectId: string;
  grantee: string;
  action: string;
  resourceScope: string;
  at?: string;
}): Promise<PermissionEvaluation> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("evaluate_permission_directives", {
    p_project_id: params.projectId,
    p_grantee: params.grantee,
    p_action: params.action,
    p_resource_scope: params.resourceScope,
    ...(params.at ? { p_at: params.at } : {}),
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      state: "unknown",
      allowCount: 0,
      denyCount: 0,
      activeCount: 0,
      directiveIds: [],
    };
  }

  return {
    state: row.state as PermissionEvaluationState,
    allowCount: Number(row.allow_count ?? 0),
    denyCount: Number(row.deny_count ?? 0),
    activeCount: Number(row.active_count ?? 0),
    directiveIds: Array.isArray(row.directive_ids) ? row.directive_ids : [],
  };
}
