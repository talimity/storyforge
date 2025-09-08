import type { WorkflowEvent } from "@storyforge/gentasks";

export type { WorkflowEvent } from "@storyforge/gentasks";
export type {
  ChatCompletionChunk,
  ChatCompletionMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from "@storyforge/inference";

export type IntentEvent =
  | { type: "intent_started"; intentId: string; scenarioId: string; kind: string; ts: number }
  | { type: "intent_finished"; intentId: string; ts: number }
  | { type: "intent_failed"; intentId: string; error: string; partialText?: string; ts: number }
  | {
      type: "effect_committed";
      intentId: string;
      sequence: number;
      effect: "new_turn" /* | "new_timeline_event" */;
      turnId: string;
      ts: number;
    }
  | { type: "actor_selected"; intentId: string; participantId: string; ts: number }
  | { type: "gen_start"; intentId: string; participantId: string; workflowId: string; ts: number }
  | { type: "gen_token"; intentId: string; stepId: string; delta: string; ts: number }
  | { type: "gen_event"; intentId: string; payload: WorkflowEvent; ts: number }
  | { type: "gen_finish"; intentId: string; workflowId: string; text: string; ts: number };
