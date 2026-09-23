import { NextRequest, NextResponse } from "next/server";
import {
  getProjectRepository,
  OperationalIntegrityError,
  recordEvidence,
} from "@/lib/db/operationalIntegrity";
import { getRepoTreeSnapshot } from "@/lib/github/client";
import { getErrorMessage } from "@/lib/errors";
import { EvidenceResult } from "@/lib/operationalIntegrity/contracts";
import { classifyGitHubVerifierIntegrity } from "@/lib/operationalIntegrity/verifierIntegrity";

const DEFAULT_MAX_FILES = 250;
const MAX_MAX_FILES = 5000;

export async function POST(req: NextRequest) {
  try {
    const {
      projectId,
      workItemId,
      sessionId,
      branch,
      path,
      maxFiles,
      githubToken,
    } = (await req.json()) as {
      projectId: string;
      workItemId?: string | null;
      sessionId?: string | null;
      branch?: string;
      path: string;
      maxFiles?: number;
      githubToken?: string;
    };

    const requestedPath = path?.trim();
    if (!projectId || !requestedPath) {
      return NextResponse.json(
        { error: "Faltan projectId o path." },
        { status: 400 }
      );
    }

    const boundedMaxFiles = Math.min(
      MAX_MAX_FILES,
      Math.max(1, Number.isFinite(maxFiles) ? Math.floor(maxFiles as number) : DEFAULT_MAX_FILES)
    );

    const projectRepo = await getProjectRepository(projectId);
    const targetBranch = branch?.trim() || projectRepo.defaultBranch;
    const snapshot = await getRepoTreeSnapshot(
      {
        owner: projectRepo.owner,
        repo: projectRepo.repo,
        branch: targetBranch,
      },
      githubToken
    );

    // La ventana observada es explícita y estable. Si no cubre todo el árbol,
    // una ausencia dentro de esa ventana NO puede convertirse en "no existe".
    const observedPaths = snapshot.paths.slice(0, boundedMaxFiles);
    const found = observedPaths.includes(requestedPath);
    const observationComplete =
      !snapshot.sourceTruncated && snapshot.paths.length <= boundedMaxFiles;

    const result: EvidenceResult = found
      ? "observed"
      : observationComplete
        ? "not_observed"
        : "partial";

    const coverage = {
      scope: "repository_file_paths",
      requestedPath,
      complete: observationComplete,
      sourceTruncated: snapshot.sourceTruncated,
      observedCount: observedPaths.length,
      returnedPathCount: snapshot.paths.length,
      maxFiles: boundedMaxFiles,
    };

    const subjectRepo = `${projectRepo.owner}/${projectRepo.repo}`;
    const verifierIntegrity = classifyGitHubVerifierIntegrity(subjectRepo);
    const artifactRef =
      `https://github.com/${projectRepo.owner}/${projectRepo.repo}/tree/${snapshot.headSha}`;

    const evidence = await recordEvidence({
      projectId,
      workItemId: workItemId ?? null,
      sessionId: sessionId ?? null,
      claim: `Repository path observation: ${requestedPath}`,
      subjectKind: "git_repository_tree",
      subjectId: `${projectRepo.owner}/${projectRepo.repo}:${snapshot.branch}`,
      subjectVersion: snapshot.headSha,
      source: "GitHub",
      environment: {
        repository: subjectRepo,
        branch: snapshot.branch,
        treeSha: snapshot.treeSha,
        verifierImplementationRepo: verifierIntegrity.implementationRepo,
        verifierImplementationSha: verifierIntegrity.implementationSha,
        verifierImplementationVersionObserved:
          verifierIntegrity.implementationVersionObserved,
      },
      configuration: {
        requestedPath,
        maxFiles: boundedMaxFiles,
      },
      verifier: "github.git.getTree",
      verifierRelation: verifierIntegrity.relation,
      result,
      artifactRef,
      coverage,
      payload: {
        pathObserved: found,
        sourceAuthority: verifierIntegrity.sourceAuthority,
        verifierImplementationRepo: verifierIntegrity.implementationRepo,
        verifierImplementationSha: verifierIntegrity.implementationSha,
        verifierImplementationVersionObserved:
          verifierIntegrity.implementationVersionObserved,
      },
    });

    return NextResponse.json({
      result,
      pathObserved: found,
      subjectVersion: snapshot.headSha,
      verifierIntegrity,
      coverage,
      evidence,
    });
  } catch (err: unknown) {
    const status = err instanceof OperationalIntegrityError ? 409 : 500;
    return NextResponse.json({ error: getErrorMessage(err) }, { status });
  }
}
