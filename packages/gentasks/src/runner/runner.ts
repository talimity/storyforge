import type {
  ChatCompletionRequest,
  ChatCompletionRequestHints,
  ChatCompletionResponse,
} from "@storyforge/inference";
import {
  compileTemplate,
  type ChatCompletionMessage as RenderedChatCompletionMessage,
  render,
} from "@storyforge/prompt-rendering";
import { safeJson } from "@storyforge/utils";
import type { ContextFor, SourcesFor, TaskKind } from "../types";
import {
  createExtendedRegistry,
  type ExtendedContext,
  ensureExtendedContext,
} from "./registry-factory";
import { RunStore } from "./run-store";
import { validateWorkflow } from "./schemas";
import type {
  GenStep,
  GenWorkflow,
  OutputCapture,
  RunHandle,
  RunnerDeps,
  RunnerEvent,
  StepResult,
  TransformSpec,
  WorkflowRunner,
} from "./types";

/**
 * Creates a workflow runner for a specific task kind
 */
export function makeWorkflowRunner<K extends TaskKind>(
  deps: RunnerDeps<K>
): WorkflowRunner<K> {
  const store = new RunStore();

  // Create an extended registry that includes stepOutput handling
  const extendedRegistry = createExtendedRegistry(deps.registry);

  async function startRun(
    workflow: GenWorkflow<K>,
    baseCtx: ContextFor<K>
  ): Promise<RunHandle> {
    const validatedWorkflow = validateWorkflow(workflow);

    // Create the run
    const {
      id: runId,
      signal,
      resultPromise,
    } = store.create(validatedWorkflow.id, validatedWorkflow.task);
    const emit = (event: RunnerEvent) => store.push(runId, event);
    const now = () => Date.now();

    // Start execution in background
    // noinspection ES6MissingAwait
    (async () => {
      emit({
        type: "run_started",
        runId,
        workflowId: validatedWorkflow.id,
        task: validatedWorkflow.task,
        ts: now(),
      });

      const stepOutputs: Record<string, unknown> = {};

      try {
        for (const step of validatedWorkflow.steps) {
          // Check for cancellation
          if (signal.aborted) {
            throw new Error("Workflow cancelled");
          }

          emit({
            type: "step_started",
            runId,
            stepId: step.id,
            name: step.name,
            ts: now(),
          });

          // Execute the step
          const result = await executeStep(step, baseCtx, stepOutputs, {
            runId,
            emit,
            now,
            signal,
          });

          // Save step outputs and response
          if (Object.keys(result.captured).length > 0) {
            Object.assign(stepOutputs, result.captured);
            store.updateStepOutputs(runId, result.captured);
          }
          store.saveStepResponse(runId, step.id, result.response);

          emit({
            type: "step_finished",
            runId,
            stepId: step.id,
            result,
            ts: now(),
          });
        }

        // Emit the final event before finalizing
        emit({ type: "run_finished", runId, output: stepOutputs, ts: now() });

        // Now finalize the run (which closes the queue)
        store.finalize(runId, stepOutputs);
      } catch (error) {
        if (signal.aborted) {
          emit({ type: "run_cancelled", runId, ts: now() });
          store.closeQueue(runId);
          // Do NOT call store.fail here; store.cancel() already rejected & closed
        } else {
          const message =
            error instanceof Error ? error.message : String(error);
          emit({ type: "run_error", runId, error: message, ts: now() });
          store.fail(runId, message);
        }
      }
    })();

    // Return runhandle immediately
    return {
      id: runId,
      events: () => store.events(runId),
      result: resultPromise,
      cancel: () => store.cancel(runId),
      snapshot: () => {
        const snap = store.snapshot(runId);
        if (!snap) {
          throw new Error(`Run ${runId} not found`);
        }
        return snap;
      },
    };
  }

  /**
   * Execute a single workflow step
   */
  async function executeStep(
    step: GenStep,
    baseCtx: ContextFor<K>,
    stepOutputs: Record<string, unknown>,
    helpers: {
      runId: string;
      emit: (event: RunnerEvent) => void;
      now: () => number;
      signal: AbortSignal;
    }
  ): Promise<StepResult> {
    const { runId, emit, now, signal } = helpers;

    // 1. Load and compile the prompt template
    const template = await deps.loadTemplate(step.promptTemplateId);
    const allowed = extendedRegistry.list?.();
    const compiled = compileTemplate<K, SourcesFor<K>>(template, {
      allowedSources: allowed?.length ? allowed : undefined,
    });

    // 2. Render the prompt with context + step outputs
    const base = ensureExtendedContext(baseCtx);
    // Incorporate outputs from previous steps
    const ctx: ExtendedContext<ContextFor<K>> = {
      ...base,
      stepInputs: { ...base.stepInputs, ...stepOutputs },
    };

    const budget = deps.budgetFactory(step.maxContextTokens);
    const messages = render(compiled, ctx, budget, extendedRegistry);

    emit({
      type: "prompt_rendered",
      runId,
      stepId: step.id,
      messages,
      ts: now(),
    });

    // 3. Apply input transforms
    const { messages: transformedMessages, changed } = applyInputTransforms(
      messages,
      step.transforms
    );
    if (changed) {
      emit({
        type: "input_transformed",
        runId,
        stepId: step.id,
        messages: transformedMessages,
        ts: now(),
      });
    }

    // 4. Derive hints for the request
    const hints = deriveHints(transformedMessages);

    // 5. Load model profile and create adapter
    const profile = await deps.loadModelProfile(step.modelProfileId);
    const adapter = deps.makeAdapter(profile.provider);

    emit({
      type: "step_prompt",
      runId,
      stepId: step.id,
      modelProfileId: step.modelProfileId,
      modelId: profile.modelId,
      hints,
      ts: now(),
    });

    // 6. Build the completion request
    const request: ChatCompletionRequest = {
      model: profile.modelId,
      messages: transformedMessages,
      maxOutputTokens: step.maxOutputTokens || 8192,
      stop: step.stop,
      genParams: { ...profile.defaultGenParams, ...step.genParams },
      hints,
      signal,
    };

    // 7. Execute the inference request (streaming)
    let aggregatedContent = "";
    let finalResponse: ChatCompletionResponse | undefined;

    const stream = adapter.completeStream(request);
    const iterator = stream[Symbol.asyncIterator]();

    while (true) {
      const { value, done } = await iterator.next();
      if (done) {
        finalResponse = value;
        break;
      }
      const chunk = value;
      if (chunk?.delta?.content) {
        aggregatedContent += chunk.delta.content;
        emit({
          type: "stream_delta",
          runId,
          stepId: step.id,
          delta: chunk.delta.content,
          ts: now(),
        });
      }
    }

    // Ensure we have a response with content
    if (!finalResponse) {
      finalResponse = {
        message: { role: "assistant", content: aggregatedContent },
        finishReason: "stop",
      };
    } else if (!finalResponse.message?.content && aggregatedContent) {
      // Provider may not include content in final response, use aggregated
      finalResponse.message = finalResponse.message || { role: "assistant" };
      finalResponse.message.content = aggregatedContent;
    }

    // 8. Apply output transforms
    // Use the final response content if available, otherwise aggregated content
    const outputContent = finalResponse.message?.content || aggregatedContent;
    const transformedOutput = applyOutputTransforms(
      outputContent,
      step.transforms
    );

    // 9. Capture outputs
    const captured = captureOutputs(step.outputs, transformedOutput);
    if (Object.keys(captured).length > 0) {
      emit({
        type: "step_captured",
        runId,
        stepId: step.id,
        outputs: captured,
        ts: now(),
      });
    }

    return { response: finalResponse, captured };
  }

  return { startRun };
}

/**
 * Derive hints for assistant prefill based on messages
 */
function deriveHints(
  messages: RenderedChatCompletionMessage[]
): ChatCompletionRequestHints {
  const last = messages.at(-1);
  if (last?.role === "assistant" && last?.prefix === true) {
    return { assistantPrefill: "require" };
  }
  return { assistantPrefill: "auto" };
}

/**
 * Apply input transforms to messages
 */
function applyInputTransforms(
  messages: RenderedChatCompletionMessage[],
  transforms?: TransformSpec[]
): { messages: RenderedChatCompletionMessage[]; changed: boolean } {
  if (!transforms?.length) return { messages, changed: false };

  let changed = false;
  let result = messages;

  for (const transform of transforms) {
    if (transform.applyTo !== "input") continue;

    result = result.map((msg) => {
      const newContent = applyTransform(msg.content, transform);
      if (newContent !== msg.content) {
        changed = true;
        return { ...msg, content: newContent };
      }
      return msg;
    });
  }

  return { messages: result, changed };
}

/**
 * Apply output transforms to text
 */
function applyOutputTransforms(
  text: string,
  transforms?: TransformSpec[]
): string {
  if (!transforms?.length) return text;

  let result = text;
  for (const transform of transforms) {
    if (transform.applyTo !== "output") continue;
    result = applyTransform(result, transform);
  }
  return result;
}

/**
 * Apply a single transform to text
 */
function applyTransform(text: string, transform: TransformSpec): string {
  if ("trim" in transform) {
    switch (transform.trim) {
      case "start":
        return text.trimStart();
      case "end":
        return text.trimEnd();
      case "both":
        return text.trim();
    }
  } else if ("regex" in transform) {
    // TODO: precompile
    const flags = transform.regex.flags ?? "g";
    const re = new RegExp(
      transform.regex.pattern,
      flags.includes("g") ? flags : `${flags}g`
    );
    return text.replace(re, transform.regex.substitution);
  }
  return text;
}

/**
 * Capture outputs from generated text
 */
function captureOutputs(
  outputs: OutputCapture[],
  text: string
): Record<string, unknown> {
  const captured: Record<string, unknown> = {};
  const parsed = safeJson(text);

  for (const output of outputs) {
    if (output.capture === "assistantText") {
      captured[output.key] = text;
    } else if (output.capture === "jsonParsed") {
      if (output.jsonPath) {
        captured[output.key] = getByPath(parsed, output.jsonPath);
      } else {
        captured[output.key] = parsed;
      }
    }
  }

  return captured;
}

/**
 * Get a value from an object by dot-notation path
 */
function getByPath(obj: unknown, path: string): unknown | undefined {
  const parts = path.split(".");
  let current = obj as Record<string, unknown>;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part] as Record<string, unknown>;
  }
  return current;
}
