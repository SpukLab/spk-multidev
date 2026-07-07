import { Octokit } from "@octokit/rest";
import { IntakeInstruction } from "../codeIntake/parser";

export interface RepoRef {
  owner: string;
  repo: string;
  branch?: string; // default: rama por defecto del repo
}

function getOctokit(token?: string): Octokit {
  const t = token || process.env.GITHUB_TOKEN;
  if (!t) throw new Error("GITHUB_TOKEN no configurado (ni personal ni del servidor).");
  return new Octokit({ auth: t });
}

/**
 * Trae el contenido REAL actual de un archivo desde GitHub.
 * Nunca hay que confiar en lo que la IA "cree" que hay en el repo
 * (CONTEXT_BASE.md sección 7) — este fetch es obligatorio antes de
 * aplicar cualquier patch o mostrar un diff.
 */
export async function fetchFileContent(
  ref: RepoRef,
  path: string,
  token?: string
): Promise<string | null> {
  const octokit = getOctokit(token);
  try {
    const res = await octokit.repos.getContent({
      owner: ref.owner,
      repo: ref.repo,
      path,
      ref: ref.branch,
    });

    if (Array.isArray(res.data) || res.data.type !== "file") {
      throw new Error(`${path} no es un archivo simple.`);
    }

    const content = Buffer.from(res.data.content, "base64").toString("utf-8");
    return content;
  } catch (err: unknown) {
    const httpErr = err as { status?: number };
    if (httpErr.status === 404) return null; // no existe todavía
    throw err;
  }
}

/**
 * Aplica una lista de instrucciones de Code Intake ya resueltas (con el
 * contenido final de cada archivo) como UN SOLO commit atómico, usando la
 * Git Data API (blobs -> tree -> commit -> update ref). Ver sección 7 y 15.
 */
export async function commitFiles(
  ref: RepoRef,
  resolvedFiles: { path: string; content: string | null }[], // content null = delete
  message: string,
  token?: string
): Promise<string> {
  const octokit = getOctokit(token);
  const branch = ref.branch ?? (await getDefaultBranch(ref, token));

  const { data: refData } = await octokit.git.getRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${branch}`,
  });
  const latestCommitSha = refData.object.sha;

  const { data: latestCommit } = await octokit.git.getCommit({
    owner: ref.owner,
    repo: ref.repo,
    commit_sha: latestCommitSha,
  });
  const baseTreeSha = latestCommit.tree.sha;

  const treeItems = await Promise.all(
    resolvedFiles.map(async (file) => {
      if (file.content === null) {
        // delete: se marca con sha null en el tree
        return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: null };
      }
      const { data: blob } = await octokit.git.createBlob({
        owner: ref.owner,
        repo: ref.repo,
        content: Buffer.from(file.content, "utf-8").toString("base64"),
        encoding: "base64",
      });
      return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: blob.sha };
    })
  );

  const { data: newTree } = await octokit.git.createTree({
    owner: ref.owner,
    repo: ref.repo,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  const { data: newCommit } = await octokit.git.createCommit({
    owner: ref.owner,
    repo: ref.repo,
    message,
    tree: newTree.sha,
    parents: [latestCommitSha],
  });

  await octokit.git.updateRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });

  return newCommit.sha;
}

/**
 * "Deshacer último push" (sección 11): revierte moviendo el branch al
 * padre del commit actual. Simple y suficiente para uso personal;
 * no reescribe historia de otros colaboradores porque el repo es de uso
 * individual.
 */
export async function undoLastPush(ref: RepoRef, token?: string): Promise<void> {
  const octokit = getOctokit(token);
  const branch = ref.branch ?? (await getDefaultBranch(ref, token));

  const { data: refData } = await octokit.git.getRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${branch}`,
  });
  const { data: commit } = await octokit.git.getCommit({
    owner: ref.owner,
    repo: ref.repo,
    commit_sha: refData.object.sha,
  });

  const parentSha = commit.parents[0]?.sha;
  if (!parentSha) throw new Error("No hay commit padre para revertir a él.");

  await octokit.git.updateRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${branch}`,
    sha: parentSha,
    force: true,
  });
}

async function getDefaultBranch(ref: RepoRef, token?: string): Promise<string> {
  const octokit = getOctokit(token);
  const { data } = await octokit.repos.get({ owner: ref.owner, repo: ref.repo });
  return data.default_branch;
}

/**
 * Lista todos los archivos del repo (recursivo) — usado por el Nivel 1 de
 * limpieza masiva (sección 15): borrado de archivos sueltos dentro de un repo.
 */
export async function listRepoTree(ref: RepoRef, token?: string): Promise<string[]> {
  const octokit = getOctokit(token);
  const branch = ref.branch ?? (await getDefaultBranch(ref, token));

  const { data: refData } = await octokit.git.getRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${branch}`,
  });

  const { data: tree } = await octokit.git.getTree({
    owner: ref.owner,
    repo: ref.repo,
    tree_sha: refData.object.sha,
    recursive: "true",
  });

  return (tree.tree ?? [])
    .filter((item) => item.type === "blob" && item.path)
    .map((item) => item.path as string);
}

export interface RepoSummary {
  owner: string;
  name: string;
  lastCommitDate: string | null;
  private: boolean;
}

/**
 * Lista todos los repos de la cuenta con fecha del último commit — usado
 * por el Nivel 2 de limpieza masiva (borrado de repos completos, sección 15)
 * y por el buscador de repos en la barra de proyecto.
 */
export async function listAccountRepos(token?: string): Promise<RepoSummary[]> {
  const octokit = getOctokit(token);
  const { data } = await octokit.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: "updated",
  });

  return data.map((r) => ({
    owner: r.owner.login,
    name: r.name,
    lastCommitDate: r.pushed_at ?? null,
    private: r.private,
  }));
}

/**
 * Borra un repo completo. IRREVERSIBLE — no existe papelera en GitHub.
 * Requiere que el token tenga el scope delete_repo habilitado (sección 15).
 * El llamador es responsable de exigir la confirmación reforzada antes de
 * invocar esto (tipear el nombre exacto del repo).
 */
export async function deleteRepo(owner: string, repo: string, token?: string): Promise<void> {
  const octokit = getOctokit(token);
  await octokit.repos.delete({ owner, repo });
}

// Re-exportado para uso en API routes que resuelven instrucciones de intake.
export type { IntakeInstruction };
