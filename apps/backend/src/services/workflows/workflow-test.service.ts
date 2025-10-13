import type { WorkflowTestRunInput, WorkflowTestRunOutput } from "@storyforge/contracts";
import type { SqliteDatabase } from "@storyforge/db";
import { type GenWorkflow, makeWorkflowRunner, turnGenRegistry } from "@storyforge/gentasks";
import { MockAdapter } from "@storyforge/inference";
import { DefaultBudgetManager, type UnboundTemplate } from "@storyforge/prompt-rendering";
import { createId } from "@storyforge/utils";
import { ServiceError } from "../../service-error.js";
import { IntentContextBuilder } from "../intent/context-builder.js";
import { fromDbPromptTemplate } from "../template/utils/marshalling.js";

export class WorkflowTestService {
  constructor(private db: SqliteDatabase) {}

  async runTest(input: WorkflowTestRunInput): Promise<WorkflowTestRunOutput> {
    // v1: only support turn_generation
    if (input.task !== "turn_generation") {
      throw new ServiceError("InvalidInput", {
        message: `Unsupported task kind for test run: ${input.task}. Only 'turn_generation' is supported for now.`,
      });
    }

    // Resolve participant by (scenarioId, characterId)
    const participant = await this.db.query.scenarioParticipants.findFirst({
      columns: { id: true },
      where: {
        scenarioId: input.scenarioId,
        characterId: input.characterId,
        status: "active",
      },
    });
    if (!participant) {
      throw new ServiceError("NotFound", {
        message: `Character ${input.characterId} is not an active participant in scenario ${input.scenarioId}.`,
      });
    }

    // Build generation context from real scenario
    const ctx = await new IntentContextBuilder(this.db, input.scenarioId).buildContext({
      actorParticipantId: participant.id,
      intent: { kind: "guided_control", constraint: input.intent?.text },
    });

    // Normalize workflow (allow persisted or draft)
    const wf = this.normalizeWorkflow(input);

    // Swap all steps to mock provider profiles and map step->modelId
    const stepModelMap: Record<string, string> = {};
    for (const step of wf.steps) {
      step.modelProfileId = `mock:${step.id}`;
      stepModelMap[step.id] = step.modelProfileId;
    }

    // Configure a single MockAdapter instance for all steps
    type MockResp = {
      text: string;
      delay?: number;
      chunkDelay?: number;
      wordsPerChunk?: number;
      metadata?: Record<string, unknown>;
    };
    type MockConfig = {
      defaultResponse?: MockResp;
      patterns?: Array<{ pattern: string; response: MockResp }>;
      modelResponses?: Record<string, MockResp>;
      streaming?: { defaultChunkDelay?: number; defaultWordsPerChunk?: number };
      models?: string[];
    };
    const mockCfg: MockConfig = {};
    if (input.mock?.defaultResponseText) {
      mockCfg.defaultResponse = { text: input.mock.defaultResponseText };
    }
    if (input.mock?.patterns?.length) {
      mockCfg.patterns = input.mock.patterns.map((p) => ({
        pattern: p.pattern,
        response: p.response,
      }));
    }
    if (input.mock?.streaming) {
      mockCfg.streaming = { ...input.mock.streaming };
    }
    if (input.mock?.stepResponses) {
      const modelResponses: Record<string, MockResp> = {};
      for (const [stepId, resp] of Object.entries(input.mock.stepResponses)) {
        const model = stepModelMap[stepId] ?? "mock-fast";
        modelResponses[model] = typeof resp === "string" ? { text: resp } : resp;
      }
      mockCfg.modelResponses = modelResponses;
    }
    const adapter = new MockAdapter({}, mockCfg);

    // Build disposable runner deps
    const runner = makeWorkflowRunner<"turn_generation">({
      loadTemplate: (id: string) => this.loadTemplate(id),
      loadModelProfile: async (profileId: string) => {
        if (!profileId.startsWith("mock:")) {
          throw new ServiceError("InvalidInput", {
            message: `Non-mock model profile '${profileId}' encountered in test run.`,
          });
        }
        const stepId = profileId.slice("mock:".length);
        const modelId = stepModelMap[stepId] ?? "mock-fast";
        return {
          id: profileId,
          displayName: profileId,
          provider: { kind: "mock", auth: {} },
          providerId: "mock-provider",
          providerName: "Mock",
          modelId,
          capabilityOverrides: undefined,
          defaultGenParams: undefined,
          modelInstruction: null,
        };
      },
      makeAdapter: () => adapter,
      registry: turnGenRegistry,
      // TODO: fallback token budget should come from the step's real model profile
      budgetFactory: (maxTokens?: number) =>
        new DefaultBudgetManager({ maxTokens: maxTokens ?? 8192 }),
    });

    // Run inline and collect results
    const handle = await runner.startRun(wf, ctx, {});
    const { finalOutputs, stepResponses } = await handle.result;
    const snap = handle.snapshot();

    // Build prompts mapping from event log
    const prompts: WorkflowTestRunOutput["prompts"] = {};
    const captureTransformed = input.options?.captureTransformedPrompts !== false;
    for (const ev of snap.events) {
      if (ev.type === "prompt_rendered") {
        const existing = prompts[ev.stepId];
        if (existing) existing.rendered = ev.messages;
        else prompts[ev.stepId] = { rendered: ev.messages };
      } else if (captureTransformed && ev.type === "input_transformed") {
        const existing = prompts[ev.stepId];
        if (existing) existing.transformed = ev.messages;
        else prompts[ev.stepId] = { rendered: [], transformed: ev.messages };
      }
    }

    return {
      workflowId: wf.id,
      task: wf.task,
      stepOrder: wf.steps.map((s) => s.id),
      prompts,
      stepResponses,
      finalOutputs,
      events: snap.events,
      meta: { scenarioId: input.scenarioId, participantId: participant.id },
    };
  }

  private async loadTemplate(templateId: string): Promise<UnboundTemplate> {
    const dbTemplate = await this.db.query.promptTemplates.findFirst({ where: { id: templateId } });
    if (!dbTemplate) {
      throw new ServiceError("NotFound", {
        message: `Prompt template with ID ${templateId} not found`,
      });
    }
    return fromDbPromptTemplate(dbTemplate);
  }

  private normalizeWorkflow(input: WorkflowTestRunInput): GenWorkflow<"turn_generation"> {
    const wfUnknown = input.workflow as unknown;
    const isPersisted =
      typeof (wfUnknown as { version?: unknown }).version === "number" &&
      typeof (wfUnknown as { id?: unknown }).id === "string";
    if (isPersisted) {
      const wf = wfUnknown as GenWorkflow<"turn_generation">;
      // Persisted/exported workflow: coerce task to requested and ensure version 1
      if (wf.task !== "turn_generation") {
        throw new ServiceError("InvalidInput", {
          message: `Workflow task '${wf.task}' does not match supported task 'turn_generation' for test runs.`,
        });
      }
      return {
        id: String(wf.id),
        name: String(wf.name),
        description: wf.description ?? undefined,
        task: "turn_generation",
        version: 1,
        steps: wf.steps,
      } as GenWorkflow<"turn_generation">;
    }

    // Draft workflow (create shape): synthesize id/version
    const draft = wfUnknown as {
      task: string;
      name: string;
      description?: string;
      steps: GenWorkflow["steps"];
    };
    if (draft?.task !== "turn_generation") {
      throw new ServiceError("InvalidInput", {
        message: `Workflow task '${draft?.task}' is not supported in test runs.`,
      });
    }
    return {
      id: `wf_test:${createId()}`,
      name: String(draft.name),
      description: draft.description ?? undefined,
      task: "turn_generation",
      version: 1 as const,
      steps: draft.steps,
    } satisfies GenWorkflow<"turn_generation">;
  }
}
