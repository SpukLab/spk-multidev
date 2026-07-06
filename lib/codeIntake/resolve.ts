import { IntakeInstruction } from "../codeIntake/parser";
import { fetchFileContent, RepoRef } from "../github/client";

export interface ResolvedFile {
  path: string;
  action: "write" | "delete" | "rename" | "patch";
  fromPath?: string;
  oldContent: string | null; // null si el archivo no existía
  newContent: string | null; // null si la acción es delete
  error?: string; // ej: FIND no matcheó — nunca se aplica a ciegas
}

/**
 * Trae el contenido real de cada archivo afectado desde GitHub (nunca se
 * confía en lo que la IA "cree" que hay en el repo) y calcula el contenido
 * final resultante de aplicar cada instrucción. No hace ningún commit —
 * solo resuelve, para que el cliente muestre el diff antes de confirmar
 * (flujo obligatorio de CONTEXT_BASE.md sección 7).
 */
export async function resolveInstructions(
  ref: RepoRef,
  instructions: IntakeInstruction[]
): Promise<ResolvedFile[]> {
  const results: ResolvedFile[] = [];

  for (const instr of instructions) {
    if (instr.path.startsWith("RECHAZADO")) {
      results.push({
        path: instr.path,
        action: instr.action,
        oldContent: null,
        newContent: null,
        error: "Path rechazado por seguridad, no se procesa.",
      });
      continue;
    }

    if (instr.action === "write") {
      const oldContent = await fetchFileContent(ref, instr.path);
      results.push({
        path: instr.path,
        action: "write",
        oldContent,
        newContent: instr.content ?? "",
      });
      continue;
    }

    if (instr.action === "delete") {
      const oldContent = await fetchFileContent(ref, instr.path);
      results.push({
        path: instr.path,
        action: "delete",
        oldContent,
        newContent: null,
      });
      continue;
    }

    if (instr.action === "rename") {
      if (!instr.fromPath) {
        results.push({
          path: instr.path,
          action: "rename",
          oldContent: null,
          newContent: null,
          error: "Falta FROM para ACTION: rename.",
        });
        continue;
      }
      const oldContent = await fetchFileContent(ref, instr.fromPath);
      results.push({
        path: instr.fromPath,
        action: "delete",
        oldContent,
        newContent: null,
      });
      results.push({
        path: instr.path,
        action: "write",
        fromPath: instr.fromPath,
        oldContent: null,
        newContent: instr.content ?? oldContent ?? "",
      });
      continue;
    }

    if (instr.action === "patch") {
      const oldContent = await fetchFileContent(ref, instr.path);
      if (oldContent === null) {
        results.push({
          path: instr.path,
          action: "patch",
          oldContent: null,
          newContent: null,
          error: "El archivo no existe en el repo — no se puede aplicar patch.",
        });
        continue;
      }

      const find = instr.find ?? "";
      if (!oldContent.includes(find)) {
        // FIND no matchea exactamente: se rechaza, nunca se aplica a ciegas.
        results.push({
          path: instr.path,
          action: "patch",
          oldContent,
          newContent: null,
          error:
            "FIND no matchea contra el contenido actual del archivo (probablemente cambió desde que la IA lo vio). Revisar manualmente.",
        });
        continue;
      }

      const newContent = oldContent.replace(find, instr.replace ?? "");
      results.push({
        path: instr.path,
        action: "patch",
        oldContent,
        newContent,
      });
    }
  }

  return results;
}
