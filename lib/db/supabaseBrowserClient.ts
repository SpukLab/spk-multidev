"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Cliente client-side, usa la key pública (anon) — nunca la service role.
// Solo puede leer lo que las políticas RLS permiten (sección 20:
// agent_jobs/agent_job_events tienen lectura pública, escritura solo
// server-side). Usado exclusivamente para suscripciones Realtime.
let cachedClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  cachedClient = createClient(url, anonKey);
  return cachedClient;
}
