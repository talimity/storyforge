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
  RenderOptions,
  SourceRegistry,
  UnboundTemplate,
} from "@storyforge/prompt-rendering";
import type { z } from "zod";
import type { ContextFor, RunnerModelContext, TaskKind, TaskSourcesMap } from "../types.js";
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

type ResolverContext<K extends TaskKind> = ContextFor<K> & {
  stepOutputs: Record<string, unknown>;
  model?: RunnerModelContext;
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
  displayName: string;
  provider: ProviderConfig;
  providerId: string;
  providerName: string;
  modelId: string;
  textTemplate?: string | null;
  modelInstruction?: string | null;
  capabilityOverrides?: Partial<TextInferenceCapabilities>;
  defaultGenParams?: Partial<TextInferenceGenParams>;
};

export type { RunnerModelContext } from "../types.js";

/**
 * Dependencies required to run a workflow.
 */
export type WorkflowDeps<K extends TaskKind> = {
  /** Function to load a prompt template by ID */
  loadTemplate: (id: string) => Promise<UnboundTemplate>;
  /** Function to load a model profile by ID */
  loadModelProfile: (id: string) => Promise<ModelProfileResolved>;
  /**
   * Function to create an inference provider adapter from the loaded model
   * profile's provider config
   */
  makeAdapter: (cfg: ProviderConfig) => ProviderAdapter;
  /**
   * Source registry for resolving data sources; used by prompt rendering to
   * fetch dynamic data
   */
  registry: SourceRegistry<ContextFor<K>, TaskSourcesMap[K]>;
  /**
   * Factory function to create a budget manager for token usage tracking and
   * enforcement
   */
  budgetFactory: (maxTokens?: number) => BudgetManager;
  /**
   * Optional factory to resolve prompt rendering options for a given step.
   * These options can use the step and context to provide additional data to
   * the prompt renderer, such as to declare Attachments and request content
   * injections at relative positions.  See AttachmentLaneSpec in the prompt-
   * rendering package for more details.
   */
  resolveRenderOptions?: (args: {
    workflow: GenWorkflow<K>;
    step: GenStep;
    baseContext: ContextFor<K>;
    extendedContext: ResolverContext<K>;
  }) => Promise<RenderOptions | undefined> | RenderOptions | undefined;
};

// Run identification
export type WorkflowRunId = string;

// Event types for workflow execution
export type WorkflowRunResume = {
  fromStepId: string;
  seededOutputs: Record<string, unknown>;
  stepResponses?: Record<string, ChatCompletionResponse>;
};

export type WorkflowRunStartOpts = {
  parentSignal?: AbortSignal;
  resume?: WorkflowRunResume;
};

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
    opts?: WorkflowRunStartOpts
  ): Promise<WorkflowRunHandle>;
}
