import { getSupabaseServerClient } from "./supabase";

export interface AgentJob {
  id: string;
  project_id: string;
  task_description: string;
  repo_owner: string;
  repo_name: string;
  branch: string;
  status: "queued" | "running" | "completed" | "failed";
  openhands_conversation_id: string | null;
  result_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentJobEvent {
  id: string;
  job_id: string;
  event_type: string;
  content: string | null;
  raw: unknown;
  created_at: string;
}

export async function createAgentJob(params: {
  projectId: string;
  taskDescription: string;
  repoOwner: string;
  repoName: string;
  branch: string;
}): Promise<AgentJob> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_jobs")
    .insert({
      project_id: params.projectId,
      task_description: params.taskDescription,
      repo_owner: params.repoOwner,
      repo_name: params.repoName,
      branch: params.branch,
      status: "queued",
    })
    .select()
    .single();
  if (error) throw error;
  return data as AgentJob;
}

export async function setJobConversationId(
  jobId: string,
  conversationId: string
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("agent_jobs")
    .update({ openhands_conversation_id: conversationId, status: "running", updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw error;
}

export async function markJobFailed(jobId: string, reason: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("agent_jobs")
    .update({ status: "failed", result_summary: reason, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw error;
}

export async function getJobByConversationId(conversationId: string): Promise<AgentJob | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_jobs")
    .select("*")
    .eq("openhands_conversation_id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return (data as AgentJob) ?? null;
}

export async function appendAgentJobEvent(
  jobId: string,
  eventType: string,
  content: string | null,
  raw: unknown
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("agent_job_events")
    .insert({ job_id: jobId, event_type: eventType, content, raw });
  if (error) throw error;
}

export async function updateJobStatus(
  jobId: string,
  status: AgentJob["status"],
  resultSummary?: string
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("agent_jobs")
    .update({
      status,
      result_summary: resultSummary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) throw error;
}

export async function listAgentJobs(projectId: string): Promise<AgentJob[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_jobs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AgentJob[];
}
