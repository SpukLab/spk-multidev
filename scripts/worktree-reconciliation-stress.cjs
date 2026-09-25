const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}
function validate(cwd) {
  const a = JSON.parse(fs.readFileSync(path.join(cwd, "capacity-a.json"), "utf8")).value;
  const b = JSON.parse(fs.readFileSync(path.join(cwd, "capacity-b.json"), "utf8")).value;
  if (a + b > 10) throw new Error(`integrated capacity exceeded: ${a} + ${b} > 10`);
  return { a, b, total: a + b };
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "spuklab-reconcile-"));
const repo = path.join(root, "repo");
const wtA = path.join(root, "wt-a");
const wtB = path.join(root, "wt-b");
fs.mkdirSync(repo);

try {
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.email", "ci@spuklab.local"]);
  git(repo, ["config", "user.name", "SpukLab CI"]);

  writeJson(path.join(repo, "capacity-a.json"), { value: 4 });
  writeJson(path.join(repo, "capacity-b.json"), { value: 4 });
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "base: balanced capacity"]);
  const baseSha = git(repo, ["rev-parse", "HEAD"]);

  git(repo, ["worktree", "add", "-b", "task-a", wtA, baseSha]);
  git(repo, ["worktree", "add", "-b", "task-b", wtB, baseSha]);

  writeJson(path.join(wtA, "capacity-a.json"), { value: 6 });
  git(wtA, ["add", "capacity-a.json"]);
  git(wtA, ["commit", "-m", "task-a: increase A"]);
  const aResult = validate(wtA);
  const aSha = git(wtA, ["rev-parse", "HEAD"]);

  writeJson(path.join(wtB, "capacity-b.json"), { value: 6 });
  git(wtB, ["add", "capacity-b.json"]);
  git(wtB, ["commit", "-m", "task-b: increase B"]);
  const bResult = validate(wtB);
  const bSha = git(wtB, ["rev-parse", "HEAD"]);

  git(repo, ["checkout", "-b", "integration", baseSha]);
  git(repo, ["merge", "--no-ff", "task-a", "-m", "merge task-a"]);
  git(repo, ["merge", "--no-ff", "task-b", "-m", "merge task-b"]);
  const integratedSha = git(repo, ["rev-parse", "HEAD"]);

  let integratedFailure = null;
  try {
    validate(repo);
  } catch (err) {
    integratedFailure = err instanceof Error ? err.message : String(err);
  }
  if (!integratedFailure) {
    throw new Error("expected integrated state to fail despite clean textual merges");
  }

  writeJson(path.join(repo, "capacity-a.json"), { value: 5 });
  writeJson(path.join(repo, "capacity-b.json"), { value: 5 });
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "reconcile: restore integrated capacity invariant"]);
  const reconciled = validate(repo);
  const reconciledSha = git(repo, ["rev-parse", "HEAD"]);

  console.log(JSON.stringify({
    baseSha,
    taskA: { sha: aSha, validation: aResult },
    taskB: { sha: bSha, validation: bResult },
    textualMergeConflicts: false,
    integratedPreReconciliation: { sha: integratedSha, validation: "FAIL", reason: integratedFailure },
    reconciled: { sha: reconciledSha, validation: "PASS", state: reconciled }
  }, null, 2));
  console.log("[RECONCILIATION STRESS] PASS: isolation and local validity did not imply integrated validity.");
} finally {
  spawnSync("git", ["worktree", "remove", "--force", wtA], { cwd: repo });
  spawnSync("git", ["worktree", "remove", "--force", wtB], { cwd: repo });
  fs.rmSync(root, { recursive: true, force: true });
}
