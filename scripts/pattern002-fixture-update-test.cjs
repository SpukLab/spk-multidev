const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const source = path.resolve(
  "fixtures/replay/context-projection/pattern001-advisory-authority-v1.json"
);
const original = JSON.parse(fs.readFileSync(source, "utf8"));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pattern002-update-"));
const staleFile = path.join(dir, "stale.json");
const updatedFile = path.join(dir, "updated.json");

function run(file) {
  return spawnSync(process.execPath, ["scripts/pattern002-replay.cjs", file], {
    encoding: "utf8",
  });
}

try {
  const oldTitle = "Promoted high-confidence learned permission claim";
  const newTitle = "Reviewed updated learned permission claim";

  // Simulate an intentional scenario/contract change while the committed
  // expectation is still stale.
  const stale = structuredClone(original);
  stale.input.buildContext.knowledgeItems[0].title = newTitle;
  fs.writeFileSync(staleFile, JSON.stringify(stale, null, 2) + "\n");

  const staleResult = run(staleFile);
  if (staleResult.status === 0) {
    throw new Error("stale golden expectation unexpectedly passed");
  }

  // Explicitly update the reviewed expectation to the new contract.
  const updated = structuredClone(stale);
  updated.expected.classifiedKnowledge[0].title = newTitle;
  updated.expected.sections = updated.expected.sections.map((section) =>
    section.id === "knowledge"
      ? { ...section, content: section.content.replace(oldTitle, newTitle) }
      : section
  );
  updated.expected.systemContent = updated.expected.systemContent.replace(
    oldTitle,
    newTitle
  );
  updated.expected.messages[0].content = updated.expected.systemContent;

  fs.writeFileSync(updatedFile, JSON.stringify(updated, null, 2) + "\n");
  const updatedResult = run(updatedFile);
  if (updatedResult.status !== 0) {
    console.error(updatedResult.stdout);
    console.error(updatedResult.stderr);
    throw new Error("reviewed fixture expectation update did not restore replay");
  }

  console.log(
    "[PATTERN-002 UPDATE] PASS: stale expectation failed and explicit fixture update restored replay."
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
