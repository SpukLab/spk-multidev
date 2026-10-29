import { test } from "node:test";
import { strict as assert } from "node:assert";
import { anthropicCompletion, chatCompletion } from "../lib/codeIntake/completion";
import { issueModelProof, verifyModelProof, issueResolutionProof, verifyResolutionProof, authorizeIntakeSource } from "../lib/codeIntake/proof";
process.env.CODE_INTAKE_PROOF_SECRET = "test-only-minimum-32-character-key-abcdefgh";

test("finish reasons distinguish truncation, completion and unknown", () => {
  assert.equal(anthropicCompletion("end_turn"), "complete");
  assert.equal(anthropicCompletion("max_tokens"), "truncated");
  assert.equal(anthropicCompletion(null), "unknown");
  assert.equal(chatCompletion("stop"), "complete");
  assert.equal(chatCompletion("length"), "truncated");
  assert.equal(chatCompletion("content_filter"), "unknown");
});
test("model proof binds exact content and status", () => {
  const content = "FILE: app/a.ts\n---\nconst x=1";
  const token = issueModelProof(content, "truncated")!;
  assert.equal(verifyModelProof(token, content), "truncated");
  assert.throws(() => verifyModelProof(token, content + "!"));
  assert.throws(() => verifyModelProof(token.slice(0,-5) + "abcde", content));
});
test("resolution proof binds branch, SHA, filenames and exact bytes", () => {
  const binding = { owner:"SpukLab", repo:"example", branch:"main", expectedHeadSha:"a".repeat(40), files:[{path:"src/a.ts",content:"export {}"}] };
  const token = issueResolutionProof(binding);
  verifyResolutionProof(token,binding);
  assert.throws(() => verifyResolutionProof(token,{...binding,branch:"other"}));
  assert.throws(() => verifyResolutionProof(token,{...binding,expectedHeadSha:"b".repeat(40)}));
  assert.throws(() => verifyResolutionProof(token,{...binding,files:[{path:"src/a.ts",content:"wrong"}]}));
  assert.throws(() => verifyResolutionProof(token,{...binding,files:[{path:"src/b.ts",content:"export {}"}]}));
});

test("generated completion cannot be bypassed by dropping its signed proof", () => {
  const content = "FILE: src/a.ts\nACTION: write\nconst x = 1";
  const truncated = issueModelProof(content,"truncated")!;
  const unknown = issueModelProof(content,"unknown")!;
  const complete = issueModelProof(content,"complete")!;
  assert.throws(() => authorizeIntakeSource({origin:"generated",rawText:content,acknowledgeUnknown:true}));
  assert.throws(() => authorizeIntakeSource({origin:"generated",rawText:content,modelProof:truncated,acknowledgeUnknown:true}));
  assert.throws(() => authorizeIntakeSource({origin:"generated",rawText:content,modelProof:unknown}));
  assert.equal(authorizeIntakeSource({origin:"generated",rawText:content,modelProof:unknown,acknowledgeUnknown:true}),"unknown");
  assert.equal(authorizeIntakeSource({origin:"generated",rawText:content,modelProof:complete}),"complete");
  assert.throws(() => authorizeIntakeSource({origin:"manual",rawText:content,modelProof:truncated,acknowledgeUnknown:true}));
  assert.throws(() => authorizeIntakeSource({origin:"manual",rawText:content}));
  assert.equal(authorizeIntakeSource({origin:"manual",rawText:content,acknowledgeUnknown:true}),"unknown");
});
