const fs = require("node:fs");
const path = require("node:path");

const { buildContext } = require("../.pattern002-test-dist/lib/contextBuilder.js");
const { applyContextBudget } = require("../.pattern002-test-dist/lib/contextBudget.js");
const {
  buildPromptSections,
  classifyKnowledgeForPrompt,
} = require("../.pattern002-test-dist/lib/promptSections.js");
const { assemblePrompt } = require("../.pattern002-test-dist/lib/promptAssembler.js");

function stable(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function actualProjection(fixture) {
  if (fixture.schema_version !== 1) {
    throw new Error(`unsupported fixture schema_version: ${fixture.schema_version}`);
  }

  const bundle = buildContext(fixture.input.buildContext);
  const { bundle: budgeted, omittedByBudget } = applyContextBudget(
    bundle,
    fixture.input.budgetChars
  );
  const sections = buildPromptSections(budgeted);
  const classifiedKnowledge = classifyKnowledgeForPrompt(budgeted);
  const assembled = assemblePrompt({
    sections,
    conversation: budgeted.conversation,
    userMessage: fixture.input.userMessage,
  });

  return {
    sectionIds: sections.map((section) => section.id),
    sections,
    classifiedKnowledge,
    omittedByBudget,
    systemContent: assembled.systemContent,
    messages: assembled.messages,
  };
}

function replayOne(file) {
  const fixture = JSON.parse(fs.readFileSync(file, "utf8"));
  const actual = actualProjection(fixture);
  const expectedText = stable(fixture.expected);
  const actualText = stable(actual);

  if (actualText !== expectedText) {
    console.error(`[PATTERN-002 REPLAY] FAIL ${fixture.name}`);
    console.error("--- expected ---");
    console.error(expectedText);
    console.error("--- actual ---");
    console.error(actualText);
    return false;
  }

  console.log(`[PATTERN-002 REPLAY] PASS ${fixture.name}`);
  return true;
}

const args = process.argv.slice(2);
const target = args[0] ?? "fixtures/replay/context-projection";
const stat = fs.statSync(target);
const files = stat.isDirectory()
  ? fs.readdirSync(target)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => path.join(target, name))
  : [target];

if (files.length === 0) {
  console.error("[PATTERN-002 REPLAY] FAIL no fixtures found");
  process.exit(1);
}

let ok = true;
for (const file of files) ok = replayOne(file) && ok;
if (!ok) process.exit(1);
