import { CompletionStatus } from "./proof";
export function anthropicCompletion(reason: unknown): CompletionStatus {
  if (reason === "end_turn" || reason === "stop_sequence") return "complete";
  if (reason === "max_tokens") return "truncated";
  return "unknown";
}
export function chatCompletion(reason: unknown): CompletionStatus {
  if (reason === "stop") return "complete";
  if (reason === "length") return "truncated";
  return "unknown";
}
