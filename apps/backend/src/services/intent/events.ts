import type { RunnerEvent } from "@storyforge/gentasks";

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
      effect: "insert_turn" | "generate_turn" | "create_timeline_event";
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
  | { type: "gen_event"; intentId: string; payload: RunnerEvent; ts: number };
