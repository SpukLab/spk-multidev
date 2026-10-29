import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type CompletionStatus = "complete" | "truncated" | "unknown";
export interface CommitFile { path: string; content: string | null; }
export interface ResolutionBinding {
  owner: string;
  repo: string;
  branch: string;
  expectedHeadSha: string;
  files: CommitFile[];
}

function digest(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
function getSecret(): string {
  const secret = process.env.CODE_INTAKE_PROOF_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CODE_INTAKE_PROOF_SECRET debe tener al menos 32 caracteres para habilitar Code Intake.");
  }
  return secret;
}
function seal(purpose: string, value: unknown): string {
  const body = Buffer.from(JSON.stringify({ purpose, value, expires: Date.now() + 60 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return body + "." + signature;
}
function open(token: string, purpose: string): unknown {
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra || token.length > 10000) throw new Error("Prueba de integridad inválida.");
  const signature = createHmac("sha256", getSecret()).update(body).digest();
  let provided: Buffer;
  try { provided = Buffer.from(mac, "base64url"); } catch { throw new Error("Firma de integridad inválida."); }
  if (provided.length !== signature.length || !timingSafeEqual(provided, signature)) {
    throw new Error("La prueba de integridad no corresponde a esta respuesta.");
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
    purpose?: string; expires?: number; value?: unknown;
  };
  if (payload.purpose !== purpose || !Number.isFinite(payload.expires) || (payload.expires ?? 0) <= Date.now()) {
    throw new Error("Prueba de integridad vencida o incorrecta; volvé a resolver.");
  }
  return payload.value;
}
export function issueModelProof(content: string, completion: CompletionStatus): string | null {
  // El chat sigue funcionando sin secreto; la resolución/commit falla de forma cerrada.
  if (!process.env.CODE_INTAKE_PROOF_SECRET) return null;
  return seal("model-completion-v1", { contentHash: digest(content), completion });
}
export function verifyModelProof(token: string, content: string): CompletionStatus {
  const value = open(token, "model-completion-v1") as { contentHash?: string; completion?: CompletionStatus };
  if (value.contentHash !== digest(content) || !["complete", "truncated", "unknown"].includes(value.completion ?? "")) {
    throw new Error("El contenido no coincide con la respuesta de IA autenticada.");
  }
  return value.completion as CompletionStatus;
}
function bindingHash(binding: ResolutionBinding): string {
  return digest(JSON.stringify({
    owner: binding.owner, repo: binding.repo, branch: binding.branch,
    expectedHeadSha: binding.expectedHeadSha, files: binding.files
  }));
}
export function issueResolutionProof(binding: ResolutionBinding): string {
  return seal("resolved-diff-v1", { bindingHash: bindingHash(binding) });
}
export function verifyResolutionProof(token: string, binding: ResolutionBinding): void {
  const value = open(token, "resolved-diff-v1") as { bindingHash?: string };
  if (value.bindingHash !== bindingHash(binding)) {
    throw new Error("El commit difiere del diff aprobado o de su HEAD; volvé a resolver.");
  }
}

// A generated response without an authenticated completion signal is NOT a
// manually supplied file. Manual intake is a separate, explicit operator path.
// A pasted file's origin cannot be cryptographically proved: no claim of
// semantic completeness follows from a manual acknowledgement.
export type IntakeOrigin = "generated" | "manual";
export function authorizeIntakeSource(input: {
  origin: IntakeOrigin;
  rawText: string;
  modelProof?: string | null;
  acknowledgeUnknown?: boolean;
}): CompletionStatus {
  if (input.origin === "generated") {
    if (!input.modelProof) {
      throw new Error("La respuesta generada no tiene prueba de finalización. No puede abrirse como contenido manual; importá únicamente un archivo revisado por vos.");
    }
    const completion = verifyModelProof(input.modelProof, input.rawText);
    if (completion === "truncated") {
      throw new Error("La IA agotó su límite de tokens. Solicitá una respuesta completa antes de resolver.");
    }
    if (completion === "unknown" && input.acknowledgeUnknown !== true) {
      throw new Error("La respuesta del modelo tiene estado desconocido. Requiere revisión humana explícita.");
    }
    return completion;
  }
  if (input.origin === "manual") {
    if (input.modelProof) {
      throw new Error("Una respuesta firmada por IA no puede reclasificarse como importación manual.");
    }
    if (input.acknowledgeUnknown !== true) {
      throw new Error("Confirmá explícitamente que revisaste el archivo importado manualmente.");
    }
    return "unknown";
  }
  throw new Error("Origen de Code Intake inválido.");
}
