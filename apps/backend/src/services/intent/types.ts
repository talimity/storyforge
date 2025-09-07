import type { IntentEvent } from "@storyforge/contracts";
import type { SqliteDatabase } from "@storyforge/db";
import type { WorkflowRunner } from "@storyforge/gentasks";
import type { TimelineService } from "../timeline/timeline.service.js";

export type CreateIntentArgs =
  | {
      kind: "manual_control";
      scenarioId: string;
      targetParticipantId: string;
      text: string;
    }
  | {
      kind: "guided_control";
      scenarioId: string;
      targetParticipantId: string;
      text: string;
    }
  | { kind: "narrative_constraint"; scenarioId: string; text: string }
  | { kind: "continue_story"; scenarioId: string };

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
};

export type IntentRunHandle = {
  id: string;
  events: () => AsyncIterable<IntentEvent>;
  cancel: () => void;
};
