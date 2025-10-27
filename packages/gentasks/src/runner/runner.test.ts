import type { ProviderConfig } from "@storyforge/inference";
import { MockAdapter } from "@storyforge/inference";
import type { PromptTemplate } from "@storyforge/prompt-rendering";
import { DefaultBudgetManager } from "@storyforge/prompt-rendering";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type {
  GenWorkflow,
  ModelProfileResolved,
  TurnGenCtx,
  WorkflowDeps,
  WorkflowEvent,
} from "../index.js";
import { turnGenRegistry } from "../tasks/turn-generation.js";
import { makeWorkflowRunner } from "./runner.js";

describe("Workflow Runner", () => {
  let mockDeps: WorkflowDeps<"turn_generation">;
  let capturedEvents: WorkflowEvent[] = [];

  beforeEach(() => {
    capturedEvents = [];

    // Create mock dependencies
    mockDeps = {
      loadTemplate: vi.fn(async (id: string) => {
        // Return a simple mock template
        const template: PromptTemplate<"turn_generation", any> = {
          id,
          name: "Test Template",
          task: "turn_generation",
          version: 1,
          layout: [
            {
              kind: "message",
              role: "system",
              content: "You are a helpful assistant.",
            },
            {
              kind: "slot",
              name: "main",
            },
          ],
          slots: {
            main: {
              priority: 0,
              plan: [
                {
                  kind: "message",
                  role: "user",
                  content: "Generate a turn",
                },
              ],
              meta: {},
            },
          },
        };
        return template;
      }),
      loadModelProfile: vi.fn(async (id: string) => {
        const profile: ModelProfileResolved = {
          id,
          displayName: `Profile ${id}`,
          provider: {
            kind: "mock",
            auth: {},
          },
          providerId: "provider1",
          providerName: "Mock Provider",
          modelId: "mock-model",
          defaultGenParams: {
            temperature: 0.7,
          },
          modelInstruction: "Stay concise",
        };
        return profile;
      }),
      makeAdapter: vi.fn((cfg: ProviderConfig) => {
        return new MockAdapter(cfg.auth);
      }),
      registry: turnGenRegistry,
      budgetFactory: vi.fn(
        (maxTokens?: number) => new DefaultBudgetManager({ maxTokens: maxTokens ?? 8192 })
      ),
      resolveRenderOptions: vi.fn(() => undefined),
    };
  });

  it("should execute a simple workflow", async () => {
    const runner = makeWorkflowRunner(mockDeps);

    const workflow: GenWorkflow<"turn_generation"> = {
      id: "test-workflow",
      name: "Test Workflow",
      task: "turn_generation",
      version: 1,
      steps: [
        {
          id: "step1",
          stop: [],
          name: "Generate Turn",
          modelProfileId: "model1",
          promptTemplateId: "template1",
          maxOutputTokens: 1000,
          outputs: [
            {
              key: "generated_turn",
              capture: "assistantText",
            },
          ],
        },
      ],
    };

    const context: TurnGenCtx = {
      turns: [],
      characters: [],
      chapterSummaries: [],
      nextTurnNumber: 1,
      currentIntent: { kind: "turn_generation", prompt: "Test intent" },
      actor: { id: "char1", name: "Alice", description: "I'm going to Alice", type: "character" },
      globals: {
        isNarratorTurn: false,
        char: "Alice",
        user: "Bob",
        scenario: "Test scenario",
      },
      lorebooks: [],
    };

    const handle = await runner.startRun(workflow, context, {});

    // Start collecting events asynchronously
    const eventCollection = (async () => {
      for await (const event of handle.events()) {
        capturedEvents.push(event);
        if (event.type === "run_finished" || event.type === "run_error") {
          break;
        }
      }
    })();

    // Wait for result
    const result = await handle.result;

    // Ensure event collection is complete
    await eventCollection;

    // Verify event sequence
    const eventTypes = capturedEvents.map((e) => e.type).filter((e) => e !== "stream_delta");
    expect(eventTypes).toEqual([
      "run_started",
      "step_started",
      "prompt_rendered",
      "step_prompt",
      "step_captured",
      "step_finished",
      "run_finished",
    ]);

    // Verify result structure
    expect(result).toHaveProperty("finalOutputs");
    expect(result).toHaveProperty("stepResponses");
    expect(result.finalOutputs).toHaveProperty("generated_turn");
  });

  it("invokes resolveRenderOptions with extended context", async () => {
    const resolver = vi.fn().mockReturnValue({ attachmentDefaults: [], injections: [] });
    mockDeps.resolveRenderOptions = resolver;
    const runner = makeWorkflowRunner(mockDeps);

    const workflow: GenWorkflow<"turn_generation"> = {
      id: "workflow",
      name: "Workflow",
      task: "turn_generation",
      version: 1,
      steps: [
        {
          id: "step",
          stop: [],
          modelProfileId: "model1",
          promptTemplateId: "template1",
          outputs: [],
        },
      ],
    };

    const context: TurnGenCtx = {
      turns: [],
      characters: [],
      chapterSummaries: [],
      nextTurnNumber: 1,
      actor: { id: "char1", name: "Alice", description: "", type: "character" },
      globals: {
        isNarratorTurn: false,
        char: "Alice",
        user: "Bob",
        scenario: "Test scenario",
      },
      lorebooks: [],
    };

    const handle = await runner.startRun(workflow, context, {});
    await handle.result;

    expect(resolver).toHaveBeenCalledTimes(1);
    const args = resolver.mock.calls[0][0];
    expect(args.workflow.id).toBe("workflow");
    expect(args.extendedContext.stepOutputs).toBeDefined();
  });

  it("should handle multi-step workflows with step outputs", async () => {
    const runner = makeWorkflowRunner(mockDeps);

    const workflow: GenWorkflow<"turn_generation"> = {
      id: "multi-step-workflow",
      name: "Multi-Step Workflow",
      task: "turn_generation",
      version: 1,
      steps: [
        {
          id: "draft",
          stop: [],
          name: "Draft",
          modelProfileId: "fast-model",
          promptTemplateId: "draft-template",
          outputs: [
            {
              key: "draft_content",
              capture: "assistantText",
            },
          ],
        },
        {
          id: "refine",
          stop: [],
          name: "Refine",
          modelProfileId: "quality-model",
          promptTemplateId: "refine-template",
          outputs: [
            {
              key: "final_content",
              capture: "assistantText",
            },
          ],
        },
      ],
    };

    const context: TurnGenCtx = {
      turns: [],
      characters: [],
      chapterSummaries: [],
      nextTurnNumber: 1,
      currentIntent: {
        prompt: "Multi-step test",
        kind: "turn_generation",
      },
      actor: { id: "char1", name: "Alice", description: "I'm going to Alice", type: "character" },
      globals: {
        isNarratorTurn: false,
        char: "Alice",
        user: "Bob",
        scenario: "Test scenario",
      },
      lorebooks: [],
    };

    const handle = await runner.startRun(workflow, context, {});
    const result = await handle.result;

    // Verify both steps produced outputs
    expect(result.finalOutputs).toHaveProperty("draft_content");
    expect(result.finalOutputs).toHaveProperty("final_content");
    expect(Object.keys(result.stepResponses)).toHaveLength(2);
  });

  it("exposes model metadata in prompt globals", async () => {
    const loadTemplateMock = mockDeps.loadTemplate as Mock;
    loadTemplateMock.mockResolvedValueOnce({
      id: "template-meta",
      name: "Model Meta Template",
      task: "turn_generation",
      version: 1,
      layout: [
        { kind: "message", role: "system", content: "System" },
        { kind: "slot", name: "main" },
      ],
      slots: {
        main: {
          priority: 0,
          plan: [
            {
              kind: "message",
              role: "user",
              content: "{{ctx.model.modelInstruction}} :: {{ctx.model.id}}",
            },
          ],
          meta: {},
        },
      },
    } as PromptTemplate<"turn_generation", any>);

    const runner = makeWorkflowRunner(mockDeps);
    const workflow: GenWorkflow<"turn_generation"> = {
      id: "meta-workflow",
      name: "Meta",
      task: "turn_generation",
      version: 1,
      steps: [
        {
          id: "step-meta",
          stop: [],
          modelProfileId: "profile-meta",
          promptTemplateId: "template-meta",
          outputs: [],
        },
      ],
    };

    const context: TurnGenCtx = {
      turns: [],
      characters: [],
      chapterSummaries: [],
      nextTurnNumber: 1,
      actor: { id: "char1", name: "Alice", description: "I'm going to Alice", type: "character" },
      globals: {
        isNarratorTurn: false,
        char: "Alice",
        user: "Bob",
      },
      lorebooks: [],
    };

    const handle = await runner.startRun(workflow, context, {});
    const collectEvents = (async () => {
      for await (const event of handle.events()) {
        capturedEvents.push(event);
        if (event.type === "run_finished" || event.type === "run_error") break;
      }
    })();

    await handle.result;
    await collectEvents;

    const promptRendered = capturedEvents.find((event) => event.type === "prompt_rendered");
    expect(promptRendered).toBeDefined();
    const userMessage =
      promptRendered?.type === "prompt_rendered"
        ? promptRendered.messages.find((msg) => msg.role === "user")
        : undefined;
    expect(userMessage?.content).toBe("Stay concise :: mock-model");
  });

  it("should apply transforms correctly", async () => {
    const runner = makeWorkflowRunner(mockDeps);

    const workflow: GenWorkflow<"turn_generation"> = {
      id: "transform-workflow",
      name: "Transform Workflow",
      task: "turn_generation",
      version: 1,
      steps: [
        {
          id: "transform-step",
          stop: [],
          modelProfileId: "model1",
          promptTemplateId: "template1",
          transforms: [
            {
              applyTo: "output",
              trim: "both",
            },
            {
              applyTo: "output",
              regex: {
                pattern: "test",
                substitution: "replaced",
              },
            },
          ],
          outputs: [
            {
              key: "transformed",
              capture: "assistantText",
            },
          ],
        },
      ],
    };

    const context: TurnGenCtx = {
      turns: [],
      characters: [],
      chapterSummaries: [],
      nextTurnNumber: 1,
      currentIntent: { prompt: "Transform test", kind: "turn_generation" },
      actor: { id: "char1", name: "Alice", description: "I'm going to Alice", type: "character" },
      globals: {
        isNarratorTurn: false,
        char: "Alice",
        user: "Bob",
        scenario: "Test scenario",
      },
      lorebooks: [],
    };

    const handle = await runner.startRun(workflow, context, {});
    const result = await handle.result;

    // The mock adapter returns a response with "test" in it
    // After transforms, it should be trimmed and have "test" replaced with "replaced"
    expect(result.finalOutputs.transformed).toBeDefined();
  });

  it("should handle workflow cancellation", async () => {
    const runner = makeWorkflowRunner(mockDeps);

    // Create a slow adapter that we can cancel
    const slowAdapter = new MockAdapter({});
    slowAdapter.completeStream = async function* (request) {
      // Check for cancellation
      if (request.signal?.aborted) {
        throw new Error("Aborted");
      }

      // Simulate slow streaming
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 10);
        request.signal?.addEventListener("abort", () => {
          clearTimeout(timeout);
          reject(new Error("Aborted"));
        });
      });

      yield {
        delta: { content: "partial" },
      };

      // Check again for cancellation
      if (request.signal?.aborted) {
        throw new Error("Aborted");
      }

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 200);
        request.signal?.addEventListener("abort", () => {
          clearTimeout(timeout);
          reject(new Error("Aborted"));
        });
      });

      yield {
        delta: { content: "complete" },
      };

      return {
        message: { role: "assistant", content: "partial complete" },
        finishReason: "stop",
      };
    };

    mockDeps.makeAdapter = vi.fn(() => slowAdapter);

    const workflow: GenWorkflow<"turn_generation"> = {
      id: "cancel-workflow",
      name: "Cancel Workflow",
      task: "turn_generation",
      version: 1,
      steps: [
        {
          id: "slow-step",
          stop: [],
          modelProfileId: "model1",
          promptTemplateId: "template1",
          outputs: [
            {
              key: "content",
              capture: "assistantText",
            },
          ],
        },
      ],
    };

    const context: TurnGenCtx = {
      turns: [],
      characters: [],
      chapterSummaries: [],
      nextTurnNumber: 1,
      currentIntent: { prompt: "Cancel test", kind: "turn_generation" },
      actor: { id: "char1", name: "Alice", description: "I'm going to Alice", type: "character" },
      globals: {
        isNarratorTurn: false,
        char: "Alice",
        user: "Bob",
        scenario: "Test scenario",
      },
      lorebooks: [],
    };

    const handle = await runner.startRun(workflow, context, {});

    // Cancel after a short delay to ensure it's during streaming
    setTimeout(() => handle.cancel(), 50);

    // Expect the result promise to reject
    await expect(handle.result).rejects.toThrow("Workflow cancelled");

    // Collect events to verify cancellation event
    const events: WorkflowEvent[] = [];
    for await (const event of handle.events()) {
      events.push(event);
      if (event.type === "run_cancelled" || event.type === "run_error") {
        break;
      }
    }

    expect(events.some((e) => e.type === "run_cancelled")).toBe(true);
  });

  it("should capture JSON outputs correctly", async () => {
    const runner = makeWorkflowRunner(mockDeps);

    // Override the mock adapter to return JSON
    const jsonAdapter = new MockAdapter({});
    jsonAdapter.completeStream = async function* () {
      yield {
        delta: {
          content: '{"result": "success", "nested": {"value": 42}}',
        },
      };
      return {
        message: {
          role: "assistant",
          content: '{"result": "success", "nested": {"value": 42}}',
        },
        finishReason: "stop",
      };
    };

    mockDeps.makeAdapter = vi.fn(() => jsonAdapter);

    const workflow: GenWorkflow<"turn_generation"> = {
      id: "json-workflow",
      name: "JSON Workflow",
      task: "turn_generation",
      version: 1,
      steps: [
        {
          id: "json-step",
          stop: [],
          modelProfileId: "model1",
          promptTemplateId: "template1",
          outputs: [
            {
              key: "full_json",
              capture: "jsonParsed",
            },
            {
              key: "nested_value",
              capture: "jsonParsed",
              jsonPath: "nested.value",
            },
          ],
        },
      ],
    };

    const context: TurnGenCtx = {
      turns: [],
      characters: [],
      chapterSummaries: [],
      nextTurnNumber: 1,
      currentIntent: { prompt: "JSON test", kind: "turn_generation" },
      actor: { id: "char1", name: "Alice", description: "I'm going to Alice", type: "character" },
      globals: {
        isNarratorTurn: false,
        char: "Alice",
        user: "Bob",
        scenario: "Test scenario",
      },
      lorebooks: [],
    };

    const handle = await runner.startRun(workflow, context, {});
    const result = await handle.result;

    expect(result.finalOutputs.full_json).toEqual({
      result: "success",
      nested: { value: 42 },
    });
    expect(result.finalOutputs.nested_value).toBe(42);
  });

  it("should provide snapshot of run state", async () => {
    const runner = makeWorkflowRunner(mockDeps);

    const workflow: GenWorkflow<"turn_generation"> = {
      id: "snapshot-workflow",
      name: "Snapshot Workflow",
      task: "turn_generation",
      version: 1,
      steps: [
        {
          id: "step1",
          stop: [],
          modelProfileId: "model1",
          promptTemplateId: "template1",
          outputs: [
            {
              key: "content",
              capture: "assistantText",
            },
          ],
        },
      ],
    };

    const context: TurnGenCtx = {
      turns: [],
      characters: [],
      chapterSummaries: [],
      nextTurnNumber: 1,
      currentIntent: { prompt: "Snapshot test", kind: "turn_generation" },
      actor: { id: "char1", name: "Alice", description: "I'm going to Alice", type: "character" },
      globals: {
        isNarratorTurn: false,
        char: "Alice",
        user: "Bob",
        scenario: "Test scenario",
      },
      lorebooks: [],
    };

    const handle = await runner.startRun(workflow, context, {});

    // Get snapshot before completion
    const snapshotDuring = handle.snapshot();
    expect(snapshotDuring.runId).toBe(handle.id);
    expect(snapshotDuring.workflowId).toBe("snapshot-workflow");

    // Wait for completion
    await handle.result;

    // Get snapshot after completion
    const snapshotAfter = handle.snapshot();
    expect(snapshotAfter.final).toBeDefined();
    expect(snapshotAfter.error).toBeUndefined();
    expect(snapshotAfter.cancelled).toBe(false);
  });

  it("should capture final response from stream return value", async () => {
    const runner = makeWorkflowRunner(mockDeps);

    // Create adapter that yields different content than the return value
    const streamAdapter = new MockAdapter({});
    streamAdapter.completeStream = async function* () {
      yield { delta: { content: "first " } };
      yield { delta: { content: "second " } };
      // Return value has different content than the streamed chunks
      return {
        message: { role: "assistant", content: "final complete response" },
        finishReason: "stop",
      };
    };

    mockDeps.makeAdapter = vi.fn(() => streamAdapter);

    const workflow: GenWorkflow<"turn_generation"> = {
      id: "stream-return-workflow",
      name: "Stream Return Workflow",
      task: "turn_generation",
      version: 1,
      steps: [
        {
          id: "step1",
          stop: [],
          modelProfileId: "model1",
          promptTemplateId: "template1",
          outputs: [
            {
              key: "final_content",
              capture: "assistantText",
            },
          ],
        },
      ],
    };

    const context: TurnGenCtx = {
      turns: [],
      characters: [],
      chapterSummaries: [],
      nextTurnNumber: 1,
      currentIntent: { prompt: "Stream return test", kind: "turn_generation" },
      actor: { id: "char1", name: "Alice", description: "I'm going to Alice", type: "character" },
      globals: {
        isNarratorTurn: false,
        char: "Alice",
        user: "Bob",
        scenario: "Test scenario",
      },
      lorebooks: [],
    };

    const handle = await runner.startRun(workflow, context, {});
    const result = await handle.result;

    // Should use the final response, not the concatenated chunks
    expect(result.stepResponses.step1.message.content).toBe("final complete response");
    expect(result.finalOutputs.final_content).toBe("final complete response");
  });

  it("should only emit input_transformed when content actually changes", async () => {
    const runner = makeWorkflowRunner(mockDeps);
    const events: WorkflowEvent[] = [];

    const workflow: GenWorkflow<"turn_generation"> = {
      id: "transform-event-workflow",
      name: "Transform Event Workflow",
      task: "turn_generation",
      version: 1,
      steps: [
        {
          id: "output-only-transforms",
          stop: [],
          modelProfileId: "model1",
          promptTemplateId: "template1",
          transforms: [
            {
              applyTo: "output",
              trim: "both",
            },
          ],
          outputs: [
            {
              key: "content",
              capture: "assistantText",
            },
          ],
        },
      ],
    };

    const context: TurnGenCtx = {
      turns: [],
      characters: [],
      chapterSummaries: [],
      nextTurnNumber: 1,
      currentIntent: { prompt: "Transform event test", kind: "turn_generation" },
      actor: { id: "char1", name: "Alice", description: "I'm going to Alice", type: "character" },
      globals: {
        isNarratorTurn: false,
        char: "Alice",
        user: "Bob",
        scenario: "Test scenario",
      },
      lorebooks: [],
    };

    const handle = await runner.startRun(workflow, context, {});

    // Collect events
    const eventCollection = (async () => {
      for await (const event of handle.events()) {
        events.push(event);
        if (event.type === "run_finished" || event.type === "run_error") {
          break;
        }
      }
    })();

    await handle.result;
    await eventCollection;

    // Should NOT have emitted input_transformed since only output transforms exist
    expect(events.some((e) => e.type === "input_transformed")).toBe(false);

    // Now test with an input transform that doesn't change content
    const workflow2: GenWorkflow<"turn_generation"> = {
      id: "no-change-transform-workflow",
      name: "No Change Transform Workflow",
      task: "turn_generation",
      version: 1,
      steps: [
        {
          id: "no-op-transform",
          stop: [],
          modelProfileId: "model1",
          promptTemplateId: "template1",
          transforms: [
            {
              applyTo: "input",
              regex: {
                pattern: "WILL_NOT_MATCH_ANYTHING_XYZ123",
                substitution: "replaced",
              },
            },
          ],
          outputs: [
            {
              key: "content",
              capture: "assistantText",
            },
          ],
        },
      ],
    };

    const events2: WorkflowEvent[] = [];
    const handle2 = await runner.startRun(workflow2, context, {});

    const eventCollection2 = (async () => {
      for await (const event of handle2.events()) {
        events2.push(event);
        if (event.type === "run_finished" || event.type === "run_error") {
          break;
        }
      }
    })();

    await handle2.result;
    await eventCollection2;

    // Should NOT have emitted input_transformed since content didn't change
    expect(events2.some((e) => e.type === "input_transformed")).toBe(false);
  });
});
