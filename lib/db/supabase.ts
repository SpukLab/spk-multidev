import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Cliente server-side únicamente. La service role key nunca debe usarse
// en el cliente (rompería la seguridad de las API keys de los proveedores
// de IA, sección 11 de CONTEXT_BASE.md).
let cachedClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase no configurado: faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  return cachedClient;
}
