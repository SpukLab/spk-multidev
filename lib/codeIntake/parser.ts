// Parser de la convención "Code Intake" definida en CONTEXT_BASE.md sección 7.
// Extrae bloques FILE/ACTION/(FROM|FIND/REPLACE)/contenido de una respuesta
// cruda de cualquier IA y los normaliza en instrucciones aplicables.

export type IntakeAction = "write" | "delete" | "rename" | "patch";

export interface IntakeInstruction {
  action: IntakeAction;
  path: string;
  fromPath?: string; // solo rename
  find?: string; // solo patch
  replace?: string; // solo patch
  content?: string; // solo write / rename
}

const BLOCK_START = /^FILE:\s*(.+)$/;
const ACTION_LINE = /^ACTION:\s*(write|delete|rename|patch)\s*$/i;
const FROM_LINE = /^FROM:\s*(.+)$/;

/**
 * Parsea el texto completo de una respuesta de IA y devuelve la lista de
 * instrucciones encontradas. Bloques de texto sin "FILE:" al inicio se
 * ignoran (son explicaciones del modelo, no código a aplicar).
 */
export function parseCodeIntake(rawText: string): IntakeInstruction[] {
  const lines = rawText.split("\n");
  const instructions: IntakeInstruction[] = [];

  let i = 0;
  while (i < lines.length) {
    const startMatch = lines[i].match(BLOCK_START);
    if (!startMatch) {
      i++;
      continue;
    }

    const path = startMatch[1].trim();
    let action: IntakeAction = "write";
    let fromPath: string | undefined;
    let find: string | undefined;
    let replace: string | undefined;
    let content: string | undefined;

    i++;

    // Metadata opcional: ACTION / FROM
    while (i < lines.length) {
      const actionMatch = lines[i].match(ACTION_LINE);
      const fromMatch = lines[i].match(FROM_LINE);

      if (actionMatch) {
        action = actionMatch[1].toLowerCase() as IntakeAction;
        i++;
        continue;
      }
      if (fromMatch) {
        fromPath = fromMatch[1].trim();
        i++;
        continue;
      }
      break;
    }

    if (action === "patch") {
      // Espera bloques FIND: / REPLACE: hasta el separador "---"
      const { find: f, replace: r, nextIndex } = extractFindReplace(lines, i);
      find = f;
      replace = r;
      i = nextIndex;
    } else if (action === "write" || action === "rename") {
      const { body, nextIndex } = extractBody(lines, i);
      content = body;
      i = nextIndex;
    } else {
      // delete: no hay cuerpo, solo avanzar hasta el próximo separador o FILE:
      i = skipToNextBlock(lines, i);
    }

    if (!validatePath(path)) {
      // Path inseguro (ej. escapa la raíz del repo) — se descarta con aviso.
      instructions.push({
        action,
        path: `RECHAZADO (path inseguro): ${path}`,
      });
      continue;
    }

    instructions.push({ action, path, fromPath, find, replace, content });
  }

  return instructions;
}

function extractFindReplace(
  lines: string[],
  startIndex: number
): { find: string; replace: string; nextIndex: number } {
  let i = startIndex;
  let mode: "none" | "find" | "replace" = "none";
  const findLines: string[] = [];
  const replaceLines: string[] = [];

  while (i < lines.length) {
    if (/^FIND:\s*$/.test(lines[i])) {
      mode = "find";
      i++;
      continue;
    }
    if (/^REPLACE:\s*$/.test(lines[i])) {
      mode = "replace";
      i++;
      continue;
    }
    if (/^---\s*$/.test(lines[i])) {
      i++;
      break;
    }
    if (BLOCK_START.test(lines[i])) {
      break; // siguiente bloque arrancó sin separador explícito
    }

    if (mode === "find") findLines.push(lines[i]);
    else if (mode === "replace") replaceLines.push(lines[i]);
    i++;
  }

  return {
    find: findLines.join("\n"),
    replace: replaceLines.join("\n"),
    nextIndex: i,
  };
}

function extractBody(
  lines: string[],
  startIndex: number
): { body: string; nextIndex: number } {
  let i = startIndex;

  // Saltar el separador "---" si está antes del contenido
  if (/^---\s*$/.test(lines[i])) {
    i++;
  }

  const bodyLines: string[] = [];
  while (i < lines.length && !BLOCK_START.test(lines[i])) {
    bodyLines.push(lines[i]);
    i++;
  }

  return { body: bodyLines.join("\n").trim(), nextIndex: i };
}

function skipToNextBlock(lines: string[], startIndex: number): number {
  let i = startIndex;
  if (/^---\s*$/.test(lines[i])) i++;
  while (i < lines.length && !BLOCK_START.test(lines[i])) {
    i++;
  }
  return i;
}

/**
 * Path safety: rechaza rutas que intenten escapar de la raíz del repo.
 */
function validatePath(path: string): boolean {
  if (path.includes("..")) return false;
  if (path.startsWith("/")) return false;
  return true;
}
