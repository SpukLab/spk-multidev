const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const source = path.resolve(
  "fixtures/replay/context-projection/pattern001-advisory-authority-v1.json"
);
const fixture = JSON.parse(fs.readFileSync(source, "utf8"));

// Simulate an accidental/unauthorized projection contract drift:
// the committed expectation now claims recalled Knowledge is authoritative.
fixture.expected.systemContent = fixture.expected.systemContent.replace(
  "[ADVISORY]",
  "[AUTHORITATIVE]"
);
fixture.expected.messages[0].content = fixture.expected.systemContent;
fixture.expected.sections = fixture.expected.sections.map((section) =>
  section.id === "knowledge"
    ? { ...section, content: section.content.replace("[ADVISORY]", "[AUTHORITATIVE]") }
    : section
);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pattern002-drift-"));
const file = path.join(dir, "drift.json");
fs.writeFileSync(file, JSON.stringify(fixture, null, 2) + "\n");

try {
  const result = spawnSync(
    process.execPath,
    ["scripts/pattern002-replay.cjs", file],
    { encoding: "utf8" }
  );

  if (result.status === 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error("replay gate failed to detect intentional drift");
  }

  if (!String(result.stderr).includes("[PATTERN-002 REPLAY] FAIL")) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error("drift failed for an unexpected reason");
  }

  console.log("[PATTERN-002 DRIFT] PASS: intentional expectation drift was rejected.");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
