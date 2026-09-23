import { VerifierRelation } from "./contracts";

const IMPLEMENTATION_REPO = "SpukLab/spk-multidev";

export interface VerifierIntegrityContext {
  implementationRepo: string;
  implementationSha: string | null;
  implementationVersionObserved: boolean;
  relation: VerifierRelation;
  sourceAuthority: "external_authoritative";
}

/**
 * Classifies only what is mechanically supportable about the relationship
 * between the subject and the verifier implementation.
 *
 * GitHub remains authoritative for the observed Git state, but repository
 * separation alone does NOT prove verifier independence. Two repositories can
 * still share the same owner, credentials, runtime, deployment controls, or
 * agent. Therefore v1 only asserts shared_control when self-verifying and
 * otherwise leaves independence unknown until an external trust boundary is
 * explicitly evidenced.
 */
export function classifyGitHubVerifierIntegrity(subjectRepo: string): VerifierIntegrityContext {
  const implementationSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.GIT_COMMIT_SHA ??
    null;

  const sameRepository =
    subjectRepo.toLowerCase() === IMPLEMENTATION_REPO.toLowerCase();

  const relation: VerifierRelation = sameRepository
    ? "shared_control"
    : "unknown";

  return {
    implementationRepo: IMPLEMENTATION_REPO,
    implementationSha,
    implementationVersionObserved: implementationSha !== null,
    relation,
    sourceAuthority: "external_authoritative",
  };
}
