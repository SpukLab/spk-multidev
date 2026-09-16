export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type AgentKind =
  | "human"
  | "analyzer"
  | "ai_model"
  | "system_process"
  | "external_source";

export type AgentStatus = "active" | "retired";

export type EpistemicStage =
  | "observation"
  | "hypothesis"
  | "validated"
  | "canon"
  | "deprecated";

export interface EntityRecord {
  id: string;
  type: string;
  role: string;
  lifecycleState: string;
  schemaVersion: number;
  createdAt: number;
  updatedAt?: number;
  attributes: Record<string, Json>;
}

export interface RelationshipRecord {
  id: string;
  type: string;
  source: string;
  target: string;
  agentId: string;
  evidence: string[];
  metadata: Record<string, Json>;
  schemaVersion: number;
  createdAt: number;
  updatedAt?: number;
}

export interface KnowledgeRecord {
  id: string;
  subject: string;
  subjectKind: "entity" | "relationship";
  kind: string;
  stage: EpistemicStage;
  payload: Record<string, Json>;
  agentId: string;
  agentVersion: string;
  evidence: string[];
  confidence: number | null;
  schemaVersion: number;
  createdAt: number;
  supersedes: string | null;
}

export interface TransitionRecord {
  id: string;
  subject: string;
  kind: string;
  fromState: string | null;
  toState: string | null;
  agentId: string;
  idempotencyKey: string;
  rationale: string | null;
  context: Record<string, Json>;
  schemaVersion: number;
  createdAt: number;
}

export interface AgentRecord {
  id: string;
  kind: AgentKind;
  name: string;
  version: string;
  metadata: Record<string, Json>;
  status: AgentStatus;
  schemaVersion: number;
  createdAt: number;
}

export type ResearchEntityType =
  | "research-intent"
  | "observatory-research-run"
  | "evidence-reference"
  | "research-subject"
  | "research-decision";

export type ResearchNextAction =
  | "BUILD"
  | "EXPERIMENT"
  | "RESEARCH"
  | "WAIT"
  | "ESCALATE"
  | "REFRAME"
  | "REJECT"
  | "ABANDON"
  | "DO_NOTHING";

export type LineageIndependence =
  | "independent"
  | "partially_dependent"
  | "dependent"
  | "unknown";

export interface ResearchIntentAttributes extends Record<string, Json> {
  title: string;
  purpose: string;
  scope: string;
  successCriteria: string[];
}

export interface ResearchRunAttributes extends Record<string, Json> {
  label: string;
  methodId: string | null;
  startedAt: number;
  endedAt: number | null;
  scope: Record<string, Json>;
}

export interface EvidenceReferenceAttributes extends Record<string, Json> {
  locator: string;
  evidenceKind: string;
  immutableVersion: string | null;
  contentDigest: string | null;
  observedAt: number;
  sourceMetadata: Record<string, Json>;
}

export interface ResearchSubjectAttributes extends Record<string, Json> {
  name: string;
  subjectKind: string;
  locator: string;
  immutableVersion: string | null;
}

export interface ResearchDecisionAttributes extends Record<string, Json> {
  domainVerdict: string;
  nextAction: ResearchNextAction;
  evidenceBasis: string[];
  unresolvedUncertainty: string[];
  openContradictions: string[];
  authority: Record<string, Json>;
  decidedAt: number;
}

export interface ObservatoryKnowledgeDraft {
  id: string;
  projectId: string;
  researchRunId: string;
  subject: string;
  subjectKind: "entity" | "relationship";
  kind: string;
  stage: Exclude<EpistemicStage, "canon">;
  payload: Record<string, Json>;
  agentId: string;
  agentVersion: string;
  evidence: string[];
  confidence: number | null;
  schemaVersion: number;
  sourceEventId: string | null;
  supersedes: string | null;
}

export interface ResearchContributionLineage {
  producerAgentId: string;
  producerAgentVersion: string;
  researchRunId: string;
  sourceEventId: string | null;
  parentEventId: string | null;
  contextFingerprint: string | null;
  evidenceIds: string[];
}

export interface ResearchFixture {
  fixtureId: string;
  intent: EntityRecord;
  run: EntityRecord;
  agents: AgentRecord[];
  subjects: EntityRecord[];
  evidence: EntityRecord[];
  knowledge: KnowledgeRecord[];
  relationships: RelationshipRecord[];
  transitions: TransitionRecord[];
  decision: EntityRecord;
}
