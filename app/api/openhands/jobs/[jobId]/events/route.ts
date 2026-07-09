import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import { getErrorMessage } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("agent_job_events")
      .select("*")
      .eq("job_id", params.jobId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ events: data ?? [] });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
