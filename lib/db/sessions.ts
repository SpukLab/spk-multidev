import { getSupabaseServerClient } from "./supabase";

export interface ProjectRecord {
  id: string;
  name: string;
  github_owner: string;
  github_repo: string;
  default_branch: string;
}

export interface SessionRecord {
  id: string;
  project_id: string;
  panel_left_provider: string | null;
  panel_left_model: string | null;
  panel_left_role: string | null;
  panel_right_provider: string | null;
  panel_right_model: string | null;
  panel_right_role: string | null;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  session_id: string;
  panel: "left" | "right";
  role: "system" | "user" | "assistant";
  content: string;
  created_at: string;
}

export async function upsertProject(
  owner: string,
  repo: string,
  branch: string
): Promise<ProjectRecord> {
  const supabase = getSupabaseServerClient();
  const { data: existing } = await supabase
    .from("projects")
    .select("*")
    .eq("github_owner", owner)
    .eq("github_repo", repo)
    .maybeSingle();

  if (existing) return existing as ProjectRecord;

  const { data, error } = await supabase
    .from("projects")
    .insert({ name: `${owner}/${repo}`, github_owner: owner, github_repo: repo, default_branch: branch })
    .select()
    .single();

  if (error) throw error;
  return data as ProjectRecord;
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectRecord[];
}

export async function createSession(projectId: string): Promise<SessionRecord> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({ project_id: projectId })
    .select()
    .single();
  if (error) throw error;
  return data as SessionRecord;
}

export async function listSessions(projectId: string): Promise<SessionRecord[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SessionRecord[];
}

export async function getMessages(sessionId: string): Promise<MessageRecord[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MessageRecord[];
}

export async function appendMessage(
  sessionId: string,
  panel: "left" | "right",
  role: "system" | "user" | "assistant",
  content: string
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("messages")
    .insert({ session_id: sessionId, panel, role, content });
  if (error) throw error;

  await supabase
    .from("sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);
}

export async function updateSessionPanels(
  sessionId: string,
  panels: Partial<SessionRecord>
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("sessions").update(panels).eq("id", sessionId);
  if (error) throw error;
}
