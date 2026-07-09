/**
 * Extrae un mensaje legible de cualquier error, sin importar su forma.
 * Los errores de Supabase (PostgrestError) y de algunas libs no son
 * instancias de `Error` de JS — solo objetos con un campo `.message` — y
 * `err instanceof Error` los ignora, cayendo a un genérico "Error
 * desconocido" que oculta la causa real. Esto cubre ambos casos.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return JSON.stringify(err);
}
