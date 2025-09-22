import type {
  ChatCompletionRequestHints,
  ChatCompletionResponse,
  ProviderAdapter,
  ProviderConfig,
  TextInferenceCapabilities,
  TextInferenceGenParams,
} from "@storyforge/inference";
import type {
  BudgetManager,
  ChatCompletionMessage,
  SourceRegistry,
  UnboundTemplate,
} from "@storyforge/prompt-rendering";
import type { z } from "zod";
import type { ContextFor, SourcesFor, TaskKind } from "../types.js";
import type { outputCaptureSchema, transformSpecSchema } from "./schemas.js";

export type TransformSpec = z.infer<typeof transformSpecSchema>;
export type OutputCapture = z.infer<typeof outputCaptureSchema>;

// Workflow definition bound to a specific task kind
export type GenWorkflow<K extends TaskKind = TaskKind> = {
  id: string;
  name: string;
  description?: string;
  task: K;
  version: 1;
  steps: GenStep[];
};

// Individual workflow step
export type GenStep = {
  id: string;
  name?: string;
  modelProfileId: string;
  promptTemplateId: string;
  genParams?: Partial<TextInferenceGenParams>;
  stop: string[];
  maxOutputTokens?: number;
  maxContextTokens?: number;
  transforms?: TransformSpec[];
  outputs: OutputCapture[];
};

// Model profile with resolved provider config
export type ModelProfileResolved = {
  id: string;
  provider: ProviderConfig;
  modelId: string;
  textTemplate?: string | null;
  capabilityOverrides?: Partial<TextInferenceCapabilities>;
  defaultGenParams?: Partial<TextInferenceGenParams>;
};

// Runner dependencies with proper typing
export type WorkflowDeps<K extends TaskKind> = {
  loadTemplate: (id: string) => Promise<UnboundTemplate>;
  loadModelProfile: (id: string) => Promise<ModelProfileResolved>;
  makeAdapter: (cfg: ProviderConfig) => ProviderAdapter;
  registry: SourceRegistry<ContextFor<K>, SourcesFor<K>>;
  budgetFactory: (maxTokens?: number) => BudgetManager;
};

// Run identification
export type WorkflowRunId = string;

// Event types for workflow execution
export type WorkflowEvent =
  | {
      type: "run_started";
      runId: WorkflowRunId;
      workflowId: string;
      task: TaskKind;
      ts: number;
    }
  | {
      type: "step_started";
      runId: WorkflowRunId;
      stepId: string;
      name?: string;
      ts: number;
    }
  | {
      type: "prompt_rendered";
      runId: WorkflowRunId;
      stepId: string;
      promptTemplateId: string;
      messages: ChatCompletionMessage[];
      ts: number;
    }
  | {
      type: "input_transformed";
      runId: WorkflowRunId;
      stepId: string;
      messages: ChatCompletionMessage[];
      ts: number;
    }
  | {
      type: "step_prompt";
      runId: WorkflowRunId;
      stepId: string;
      modelProfileId: string;
      modelId: string;
      hints?: ChatCompletionRequestHints;
      ts: number;
    }
  | {
      type: "stream_delta";
      runId: WorkflowRunId;
      stepId: string;
      delta: string;
      ts: number;
    }
  | {
      type: "step_captured";
      runId: WorkflowRunId;
      stepId: string;
      outputs: Record<string, unknown>;
      ts: number;
    }
  | {
      type: "step_finished";
      runId: WorkflowRunId;
      stepId: string;
      result: GenStepResult;
      ts: number;
    }
  | {
      type: "run_finished";
      runId: WorkflowRunId;
      output: Record<string, unknown>;
      ts: number;
    }
  | { type: "run_cancelled"; runId: WorkflowRunId; ts: number }
  | {
      type: "run_error";
      runId: WorkflowRunId;
      stepId?: string;
      error: string;
      ts: number;
    };

// Step execution result
export type GenStepResult = {
  response: ChatCompletionResponse;
  captured: Record<string, unknown>;
};

// Snapshot of a run's current state
export type WorkflowRunSnapshot = {
  runId: WorkflowRunId;
  workflowId: string;
  events: WorkflowEvent[];
  stepOutputs: Record<string, unknown>;
  stepResponses: Record<string, ChatCompletionResponse>;
  final?: Record<string, unknown>;
  cancelled?: boolean;
  error?: string;
};

// Handle for controlling and observing a run
export type WorkflowRunHandle = {
  id: WorkflowRunId;
  events(): AsyncIterable<WorkflowEvent>;
  result: Promise<{
    finalOutputs: Record<string, unknown>;
    stepResponses: Record<string, ChatCompletionResponse>;
  }>;
  cancel(): void;
  snapshot(): WorkflowRunSnapshot;
};

// Workflow runner interface
export interface WorkflowRunner<K extends TaskKind> {
  startRun(
    workflow: GenWorkflow<K>,
    ctx: ContextFor<K>,
    opts: { parentSignal?: AbortSignal }
  ): Promise<WorkflowRunHandle>;
}
