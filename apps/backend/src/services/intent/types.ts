import type { SqliteDatabase } from "@storyforge/db";
import type { WorkflowEvent, WorkflowRunner } from "@storyforge/gentasks";
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

export type IntentEvent =
  | {
      type: "intent_started";
      intentId: string;
      scenarioId: string;
      kind: string;
      ts: number;
    }
  | { type: "intent_finished"; intentId: string; ts: number }
  | {
      type: "intent_failed";
      intentId: string;
      error: string;
      partialText?: string;
      ts: number;
    }
  | {
      type: "effect_committed";
      intentId: string;
      effect: "new_turn" /* | "new_timeline_event" */;
      turnId: string;
      ts: number;
    }
  | {
      type: "actor_selected";
      intentId: string;
      participantId: string;
      ts: number;
    }
  | {
      type: "gen_token";
      intentId: string;
      stepId: string;
      delta: string;
      ts: number;
    }
  | { type: "gen_event"; intentId: string; payload: WorkflowEvent; ts: number };

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

export type IntentHandle = {
  id: string;
  events: () => AsyncIterable<IntentEvent>;
  cancel: () => void;
};
