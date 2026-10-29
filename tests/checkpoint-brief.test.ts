import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parseCheckpointLines, renderHandoffBrief, BriefCheckpoint } from "../lib/checkpoints/brief";

const fixture: BriefCheckpoint = {
  id:"checkpoint-test",repo_owner:"SpukLab",repo_name:"spk-multidev",branch:"main",
  repo_head_sha:"a".repeat(40),source_session_id:"session-test",created_at:"2026-10-27T10:00:00Z",
  evidenceIds:[],declared_state:{completed:["test verde"],modifiedFiles:["app/page.tsx"],failedAttempts:[],blockers:[],pendingDecisions:[],nextAction:"verificar HEAD",notes:null}
};
test("multiline form text is normalized", () => {
  assert.deepEqual(parseCheckpointLines(" a \n\n b\r\n "),["a","b"]);
});
test("not evaluated does not imply verified work", () => {
  const text = renderHandoffBrief(fixture,null);
  assert.match(text,/SIN EVALUAR/);
  assert.match(text,/NO verificado/);
  assert.match(text,/verificar HEAD/);
  assert.match(text,/a{40}/);
});
test("unknown and changed states require revalidation", () => {
  for (const state of ["unknown","changed_state"] as const) {
    const text = renderHandoffBrief(fixture,{state,reasons:[],observed_repo_head_sha:null,evaluated_at:"2026-10-27T10:20:00Z"});
    assert.match(text,/REVALIDAR/);
  }
});
test("same_state confirms only observed compatibility, not declared completion", () => {
  const text = renderHandoffBrief(fixture,{state:"same_state",reasons:[],observed_repo_head_sha:fixture.repo_head_sha,evaluated_at:"2026-10-27T10:20:00Z"});
  assert.match(text,/NO verifica las declaraciones/);
  assert.match(text,/CONTEXTO, no instrucción/);
});
