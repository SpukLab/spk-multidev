import type {
  AgentRecord,
  Json,
  ObservatoryKnowledgeDraft,
  ResearchContributionLineage,
  ResearchNextAction,
} from "./contracts";

export class ObservatoryInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObservatoryInvariantError";
  }
}

const ALLOWED_NEXT_ACTIONS = new Set<ResearchNextAction>([
  "BUILD",
  "EXPERIMENT",
  "RESEARCH",
  "WAIT",
  "ESCALATE",
  "REFRAME",
  "REJECT",
  "ABANDON",
  "DO_NOTHING",
]);

export function assertEpistemicConfidence(value: number | null): void {
  if (value === null) return;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new ObservatoryInvariantError(
      "Epistemic confidence must be null or a finite number between 0 and 1."
    );
  }
}

export function assertObservatoryKnowledgeDraft(
  draft: ObservatoryKnowledgeDraft
): void {
  if (!draft.projectId) {
    throw new ObservatoryInvariantError("Observatory Knowledge requires projectId.");
  }
  if (!draft.researchRunId) {
    throw new ObservatoryInvariantError("Observatory Knowledge requires researchRunId.");
  }
  if (!draft.subject) {
    throw new ObservatoryInvariantError("Observatory Knowledge requires a subject.");
  }
  if (!draft.agentId || !draft.agentVersion) {
    throw new ObservatoryInvariantError(
      "Observatory Knowledge requires producer Agent id and version."
    );
  }
  if (!draft.kind) {
    throw new ObservatoryInvariantError("Observatory Knowledge requires kind.");
  }
  if (!draft.payload || Array.isArray(draft.payload)) {
    throw new ObservatoryInvariantError(
      "Observatory Knowledge requires a structured object payload."
    );
  }
  if (!Array.isArray(draft.evidence)) {
    throw new ObservatoryInvariantError(
      "Observatory Knowledge requires an explicit evidence list, even when empty."
    );
  }
  if (draft.schemaVersion < 1) {
    throw new ObservatoryInvariantError("schemaVersion must be >= 1.");
  }
  assertEpistemicConfidence(draft.confidence);
}

export function assertAgentVersionMatches(
  agent: AgentRecord,
  recordedVersion: string
): void {
  if (agent.version !== recordedVersion) {
    throw new ObservatoryInvariantError(
      `Producer Agent version mismatch: expected ${recordedVersion}, found ${agent.version}.`
    );
  }
}

export function assertResearchDecisionNextAction(
  action: ResearchNextAction
): void {
  if (!ALLOWED_NEXT_ACTIONS.has(action)) {
    throw new ObservatoryInvariantError(`Unsupported research next action: ${action}`);
  }
}

export function assertCurationDoesNotImplyEpistemicStage(params: {
  previousCurationStatus: "captured" | "promoted" | "rejected";
  nextCurationStatus: "captured" | "promoted" | "rejected";
  previousEpistemicStage: string | null;
  nextEpistemicStage: string | null;
}): void {
  const curationChanged =
    params.previousCurationStatus !== params.nextCurationStatus;
  if (
    curationChanged &&
    params.previousEpistemicStage !== params.nextEpistemicStage
  ) {
    throw new ObservatoryInvariantError(
      "A curation transition must not change epistemic stage."
    );
  }
}

export function assertEpistemicTransitionDoesNotChangeCuration(params: {
  previousCurationStatus: "captured" | "promoted" | "rejected";
  nextCurationStatus: "captured" | "promoted" | "rejected";
  previousEpistemicStage: string | null;
  nextEpistemicStage: string | null;
}): void {
  const epistemicChanged =
    params.previousEpistemicStage !== params.nextEpistemicStage;
  if (
    epistemicChanged &&
    params.previousCurationStatus !== params.nextCurationStatus
  ) {
    throw new ObservatoryInvariantError(
      "An epistemic transition must not change curation status."
    );
  }
}

export function assertOrdinaryObservatoryStage(stage: string): void {
  if (stage === "canon") {
    throw new ObservatoryInvariantError(
      "Ordinary Observatory/model APIs cannot promote Knowledge to canon."
    );
  }
}

export function independenceClaimIsDisprovenByLineage(
  left: ResearchContributionLineage,
  right: ResearchContributionLineage
): boolean {
  if (
    left.contextFingerprint &&
    right.contextFingerprint &&
    left.contextFingerprint === right.contextFingerprint
  ) {
    return true;
  }

  if (
    left.sourceEventId &&
    right.parentEventId &&
    left.sourceEventId === right.parentEventId
  ) {
    return true;
  }

  if (
    right.sourceEventId &&
    left.parentEventId &&
    right.sourceEventId === left.parentEventId
  ) {
    return true;
  }

  return false;
}

/**
 * Produces deterministic JSON-safe input for a later SHA-256 fingerprint.
 * This function does not hash: hashing belongs to the runtime adapter.
 * Volatile `generatedAt` fields are removed recursively and object keys are sorted.
 */
export function canonicalizeContextFingerprintInput(value: Json): Json {
  if (Array.isArray(value)) {
    return value.map(canonicalizeContextFingerprintInput);
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([key]) => key !== "generatedAt")
      .sort(([left], [right]) => left.localeCompare(right));

    const normalized: Record<string, Json> = {};
    for (const [key, child] of entries) {
      normalized[key] = canonicalizeContextFingerprintInput(child);
    }
    return normalized;
  }

  return value;
}
