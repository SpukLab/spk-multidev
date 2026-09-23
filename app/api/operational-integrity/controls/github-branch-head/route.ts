import { NextRequest, NextResponse } from "next/server";
import {
  ensureControlDefinition,
  getProjectRepository,
  OperationalIntegrityError,
  recordControlRunWithEvidence,
} from "@/lib/db/operationalIntegrity";
import { getBranchHeadSha } from "@/lib/github/client";
import { getErrorMessage } from "@/lib/errors";
import { classifyGitHubVerifierIntegrity } from "@/lib/operationalIntegrity/verifierIntegrity";

const CONTROL_KEY = "github.branch-head.matches";

export async function POST(req: NextRequest) {
  try {
    const { projectId, workItemId, sessionId, branch, expectedSha, githubToken } =
      (await req.json()) as {
        projectId: string;
        workItemId?: string | null;
        sessionId?: string | null;
        branch?: string;
        expectedSha: string;
        githubToken?: string;
      };

    if (!projectId || !expectedSha) {
      return NextResponse.json(
        { error: "Faltan projectId o expectedSha." },
        { status: 400 }
      );
    }

    const projectRepo = await getProjectRepository(projectId);
    const targetBranch = branch?.trim() || projectRepo.defaultBranch;

    // El caller aporta el SHA esperado, nunca el observado. El valor real
    // se obtiene de GitHub en el instante del control.
    const observed = await getBranchHeadSha(
      {
        owner: projectRepo.owner,
        repo: projectRepo.repo,
        branch: targetBranch,
      },
      githubToken
    );

    const control = await ensureControlDefinition({
      projectId,
      controlKey: CONTROL_KEY,
      name: "GitHub branch head matches expected SHA",
      mechanism: "github.git.getRef + exact SHA equality",
      description:
        "Verifica de forma determinista que el HEAD real de una rama en GitHub coincide con el SHA esperado.",
    });

    const passed = observed.sha === expectedSha.trim();
    const subjectRepo = `${projectRepo.owner}/${projectRepo.repo}`;
    const verifierIntegrity = classifyGitHubVerifierIntegrity(subjectRepo);
    const artifactRef =
      `https://github.com/${projectRepo.owner}/${projectRepo.repo}/commit/${observed.sha}`;

    const recorded = await recordControlRunWithEvidence({
      control,
      projectId,
      workItemId: workItemId ?? null,
      sessionId: sessionId ?? null,
      subjectKind: "git_branch_head",
      subjectId: `${projectRepo.owner}/${projectRepo.repo}:${observed.branch}`,
      subjectVersion: observed.sha,
      outcome: passed ? "pass" : "fail",
      executor: "system:github-branch-head-control",
      environment: {
        repository: subjectRepo,
        branch: observed.branch,
        verifierImplementationRepo: verifierIntegrity.implementationRepo,
        verifierImplementationSha: verifierIntegrity.implementationSha,
      },
      configuration: {
        expectedSha: expectedSha.trim(),
      },
      artifactRef,
      claim: "GitHub branch head matches expected SHA",
      source: "GitHub",
      verifier: "github.git.getRef",
      verifierRelation: verifierIntegrity.relation,
      evidencePayload: {
        expectedSha: expectedSha.trim(),
        actualSha: observed.sha,
        sourceAuthority: verifierIntegrity.sourceAuthority,
        verifierImplementationRepo: verifierIntegrity.implementationRepo,
        verifierImplementationSha: verifierIntegrity.implementationSha,
      },
      coverage: {
        scope: "single_branch_head",
        complete: true,
      },
    });

    return NextResponse.json({
      controlDefined: true,
      controlExecuted: true,
      controlPassed: passed,
      evidencePersisted: recorded.evidencePersisted,
      expectedSha: expectedSha.trim(),
      actualSha: observed.sha,
      verifierIntegrity,
      run: recorded.run,
      evidence: recorded.evidence,
    });
  } catch (err: unknown) {
    const status = err instanceof OperationalIntegrityError ? 409 : 500;
    return NextResponse.json({ error: getErrorMessage(err) }, { status });
  }
}
