import type { IntentEvent } from "@storyforge/contracts";
import type { SqliteDatabase } from "@storyforge/db";
import type { WorkflowRunner } from "@storyforge/gentasks";
import type { TimelineService } from "../timeline/timeline.service.js";

export type CreateIntentArgs = {
  scenarioId: string;
  branchFrom?: { kind: "turn_parent" | "intent_start"; targetId: string };
} & (
  | { kind: "manual_control"; targetParticipantId: string; text: string }
  | { kind: "guided_control"; targetParticipantId: string; text: string }
  | { kind: "narrative_constraint"; text: string; targetParticipantId?: string }
  | { kind: "continue_story"; targetParticipantId?: string }
);

export type IntentGenerator = AsyncGenerator<IntentEvent, void, void>;
export type IntentCommandGenerator<T> = AsyncGenerator<IntentEvent, T, void>;

export type IntentExecDeps = {
  db: SqliteDatabase;
  timeline: TimelineService;
  runner: WorkflowRunner<"turn_generation">;
  now: () => number;
  intentId: string;
  scenarioId: string;
  signal: AbortSignal;
  branchFromTurnId?: string;
};

export type IntentRunHandle = {
  id: string;
  events: () => AsyncIterable<IntentEvent>;
  cancel: () => void;
};
