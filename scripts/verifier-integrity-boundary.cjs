const assert = require("node:assert/strict");
const {
  classifyGitHubVerifierIntegrity,
} = require("../.verifier-integrity-test-dist/lib/operationalIntegrity/verifierIntegrity.js");

const keys = ["VERCEL_GIT_COMMIT_SHA", "GITHUB_SHA", "GIT_COMMIT_SHA"];
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

function clearBuildIdentity() {
  for (const key of keys) delete process.env[key];
}

try {
  clearBuildIdentity();

  const selfUnknownBuild = classifyGitHubVerifierIntegrity("SpukLab/spk-multidev");
  assert.equal(selfUnknownBuild.relation, "shared_control");
  assert.equal(selfUnknownBuild.implementationVersionObserved, false);
  assert.equal(selfUnknownBuild.implementationSha, null);
  assert.equal(selfUnknownBuild.sourceAuthority, "external_authoritative");

  process.env.GITHUB_SHA = "0123456789abcdef";
  const selfKnownBuild = classifyGitHubVerifierIntegrity("spuklab/SPK-MULTIDEV");
  assert.equal(selfKnownBuild.relation, "shared_control");
  assert.equal(selfKnownBuild.implementationVersionObserved, true);
  assert.equal(selfKnownBuild.implementationSha, "0123456789abcdef");
  assert.equal(selfKnownBuild.sourceAuthority, "external_authoritative");

  const otherRepo = classifyGitHubVerifierIntegrity("SpukLab/another-repository");
  assert.equal(
    otherRepo.relation,
    "unknown",
    "repository separation alone must never be promoted to independent verification",
  );
  assert.equal(otherRepo.implementationVersionObserved, true);
  assert.equal(otherRepo.sourceAuthority, "external_authoritative");

  assert.notEqual(
    selfKnownBuild.sourceAuthority,
    selfKnownBuild.relation,
    "authoritative source and verifier relationship are separate dimensions",
  );

  console.log("[VERIFIER INTEGRITY] PASS: source authority remains separate from verifier independence.");
} finally {
  clearBuildIdentity();
  for (const key of keys) {
    if (saved[key] !== undefined) process.env[key] = saved[key];
  }
}
