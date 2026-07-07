const KEYS_STORAGE_KEY = "spk-multidev:api-keys";
const ROLES_STORAGE_KEY = "spk-multidev:custom-roles";

export interface StoredApiKeys {
  nvidia?: string;
  anthropic?: string;
  openai?: string;
  github?: string;
}

/**
 * Keys personales del usuario, guardadas SOLO en su navegador (localStorage).
 * Nunca se persisten en el servidor ni en Supabase — si el hub se distribuye
 * a otras personas, cada una carga sus propias keys acá y quedan aisladas
 * de las del dueño original del deploy.
 */
export function loadApiKeys(): StoredApiKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEYS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveApiKeys(keys: StoredApiKeys): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys));
}

export interface CustomRole {
  id: string;
  label: string;
  systemPrompt: string;
}

export function loadCustomRoles(): CustomRole[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROLES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomRoles(roles: CustomRole[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(roles));
}
