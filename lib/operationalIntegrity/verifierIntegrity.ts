import { VerifierRelation } from "./contracts";

const IMPLEMENTATION_REPO = "SpukLab/spk-multidev";

export interface VerifierIntegrityContext {
  implementationRepo: string;
  implementationSha: string | null;
  relation: VerifierRelation;
  sourceAuthority: "external_authoritative";
}

/**
 * Classifies the relationship between the subject under evaluation and the
 * code implementing the verifier.
 *
 * GitHub remains authoritative for the observed Git state, but that does not
 * automatically make the verifier implementation independent.
 */
export function classifyGitHubVerifierIntegrity(subjectRepo: string): VerifierIntegrityContext {
  const implementationSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.GIT_COMMIT_SHA ??
    null;

  let relation: VerifierRelation;
  if (!implementationSha) {
    relation = "unknown";
  } else if (subjectRepo.toLowerCase() === IMPLEMENTATION_REPO.toLowerCase()) {
    relation = "shared_control";
  } else {
    relation = "independent";
  }

  return {
    implementationRepo: IMPLEMENTATION_REPO,
    implementationSha,
    relation,
    sourceAuthority: "external_authoritative",
  };
}
