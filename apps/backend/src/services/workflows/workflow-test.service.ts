import type { WorkflowTestRunInput, WorkflowTestRunOutput } from "@storyforge/contracts";
import type { SqliteDatabase } from "@storyforge/db";
import {
  buildChapterSummarizationRenderOptions,
  buildTurnGenRenderOptions,
  type ContextFor,
  chapterSummarizationRegistry,
  type GenWorkflow,
  makeWorkflowRunner,
  type TaskKind,
  turnGenRegistry,
} from "@storyforge/gentasks";
import { MockAdapter } from "@storyforge/inference";
import { DefaultBudgetManager, type UnboundTemplate } from "@storyforge/prompt-rendering";
import { createId } from "@storyforge/utils";
import { ServiceError } from "../../service-error.js";
import { ChapterSummaryContextBuilder } from "../chapter-summaries/context-builder.js";
import { IntentContextBuilder } from "../intent/context-builder.js";
import { fromDbPromptTemplate } from "../template/utils/marshalling.js";

type TurnGenTestInput = WorkflowTestRunInput & {
  task: "turn_generation";
  characterId: string;
  intent: { kind: "guided_control"; text?: string };
};

type ChapterSummTestInput = WorkflowTestRunInput & {
  task: "chapter_summarization";
  closingEventId: string;
};

type ExecutionResult = Pick<
  WorkflowTestRunOutput,
  "workflowId" | "stepOrder" | "prompts" | "stepResponses" | "finalOutputs" | "events"
>;

type RunnerDeps<T extends TaskKind> = Parameters<typeof makeWorkflowRunner<T>>[0];

type ExecuteArgs<T extends TaskKind> = {
  task: T;
  workflow: GenWorkflow<T>;
  context: ContextFor<T>;
  registry: RunnerDeps<T>["registry"];
  resolveRenderOptions?: RunnerDeps<T>["resolveRenderOptions"];
  mock: WorkflowTestRunInput["mock"];
  captureTransformedPrompts: boolean;
};

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
};

export class WorkflowTestService {
  private readonly chapterContextBuilder: ChapterSummaryContextBuilder;

  constructor(private readonly db: SqliteDatabase) {
    this.chapterContextBuilder = new ChapterSummaryContextBuilder(db);
  }

  async runTest(input: WorkflowTestRunInput): Promise<WorkflowTestRunOutput> {
    const { task } = input;

    if (task === "turn_generation") {
      return this.runTurnGenerationTest(input as TurnGenTestInput);
    }

    if (task === "chapter_summarization") {
      return this.runChapterSummarizationTest(input as ChapterSummTestInput);
    }

    throw new ServiceError("InvalidInput", {
      message: `Unsupported task kind for test run: ${task}.`,
    });
  }

  private async runTurnGenerationTest(input: TurnGenTestInput): Promise<WorkflowTestRunOutput> {
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

    const intentBuilder = new IntentContextBuilder(this.db, input.scenarioId);
    const ctx = await intentBuilder.buildContext({
      actorParticipantId: participant.id,
      intent: { kind: input.intent?.kind ?? "guided_control", constraint: input.intent?.text },
    });

    const workflow = this.normalizeWorkflow(input.workflow, "turn_generation");
    const execution = await this.executeTestRun({
      task: "turn_generation",
      workflow,
      context: ctx,
      registry: turnGenRegistry,
      resolveRenderOptions: ({ extendedContext }) => buildTurnGenRenderOptions(extendedContext),
      mock: input.mock,
      captureTransformedPrompts: input.options?.captureTransformedPrompts ?? true,
    });

    return {
      ...execution,
      task: "turn_generation",
      meta: { scenarioId: input.scenarioId, participantId: participant.id },
    };
  }

  private async runChapterSummarizationTest(
    input: ChapterSummTestInput
  ): Promise<WorkflowTestRunOutput> {
    const { node, span, context } = await this.chapterContextBuilder.buildContextForClosingEvent({
      scenarioId: input.scenarioId,
      closingEventId: input.closingEventId,
    });

    const workflow = this.normalizeWorkflow(input.workflow, "chapter_summarization");
    const execution = await this.executeTestRun({
      task: "chapter_summarization",
      workflow,
      context,
      registry: chapterSummarizationRegistry,
      resolveRenderOptions: ({ extendedContext }) =>
        buildChapterSummarizationRenderOptions(extendedContext),
      mock: input.mock,
      captureTransformedPrompts: input.options?.captureTransformedPrompts ?? true,
    });

    return {
      ...execution,
      task: "chapter_summarization",
      meta: {
        scenarioId: input.scenarioId,
        closingEventId: span.closingEventId,
        chapterNumber: node.chapter.chapterNumber,
      },
    };
  }

  private async executeTestRun<T extends TaskKind>(args: ExecuteArgs<T>): Promise<ExecutionResult> {
    const { workflow, stepModelMap, adapter } = this.prepareWorkflowForMockRun(
      args.workflow,
      args.mock
    );

    const runner = makeWorkflowRunner<T>({
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
          modelInstruction: "Write some mock stuff.",
        };
      },
      makeAdapter: () => adapter,
      registry: args.registry,
      budgetFactory: (maxTokens?: number) =>
        new DefaultBudgetManager({ maxTokens: maxTokens ?? 8192 }),
      resolveRenderOptions: args.resolveRenderOptions,
    });

    const handle = await runner.startRun(workflow, args.context, {});
    const { finalOutputs, stepResponses } = await handle.result;
    const snap = handle.snapshot();
    const prompts = this.collectPrompts(snap.events, args.captureTransformedPrompts);

    return {
      workflowId: workflow.id,
      stepOrder: workflow.steps.map((s) => s.id),
      prompts,
      stepResponses,
      finalOutputs,
      events: snap.events,
    };
  }

  private prepareWorkflowForMockRun<T extends TaskKind>(
    workflow: GenWorkflow<T>,
    mock: WorkflowTestRunInput["mock"]
  ) {
    const stepModelMap: Record<string, string> = {};
    for (const step of workflow.steps) {
      step.modelProfileId = `mock:${step.id}`;
      stepModelMap[step.id] = step.modelProfileId;
    }
    const mockCfg = this.createMockConfig(mock, stepModelMap);
    const adapter = new MockAdapter({}, mockCfg);
    return { workflow, stepModelMap, adapter };
  }

  private createMockConfig(
    mock: WorkflowTestRunInput["mock"],
    stepModelMap: Record<string, string>
  ): MockConfig {
    if (!mock) return {};
    const cfg: MockConfig = {};
    if (mock.defaultResponseText) {
      cfg.defaultResponse = { text: mock.defaultResponseText };
    }
    if (mock.patterns?.length) {
      cfg.patterns = mock.patterns.map((p) => ({ pattern: p.pattern, response: p.response }));
    }
    if (mock.streaming) {
      cfg.streaming = { ...mock.streaming, defaultChunkDelay: 1 };
    }
    if (mock.stepResponses) {
      const modelResponses: Record<string, MockResp> = {};
      for (const [stepId, resp] of Object.entries(mock.stepResponses)) {
        const model = stepModelMap[stepId] ?? "mock-fast";
        modelResponses[model] = typeof resp === "string" ? { text: resp } : resp;
      }
      cfg.modelResponses = modelResponses;
    }
    return cfg;
  }

  private collectPrompts(
    events: WorkflowTestRunOutput["events"],
    captureTransformed: boolean
  ): WorkflowTestRunOutput["prompts"] {
    const prompts: WorkflowTestRunOutput["prompts"] = {};
    for (const ev of events) {
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
    return prompts;
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

  private normalizeWorkflow<T extends TaskKind>(
    workflowInput: WorkflowTestRunInput["workflow"],
    expectedTask: T
  ): GenWorkflow<T> {
    const wfUnknown = workflowInput as unknown;
    const isPersisted =
      typeof (wfUnknown as { version?: unknown }).version === "number" &&
      typeof (wfUnknown as { id?: unknown }).id === "string";

    if (isPersisted) {
      const wf = wfUnknown as GenWorkflow<T>;
      if (wf.task !== expectedTask) {
        throw new ServiceError("InvalidInput", {
          message: `Workflow task '${wf.task}' does not match supported task '${expectedTask}' for test runs.`,
        });
      }
      return {
        id: String(wf.id),
        name: String(wf.name),
        description: wf.description ?? undefined,
        task: expectedTask,
        version: 1,
        steps: wf.steps,
      };
    }

    const draft = wfUnknown as {
      task: TaskKind;
      name: string;
      description?: string;
      steps: GenWorkflow["steps"];
    };

    if (draft?.task !== expectedTask) {
      throw new ServiceError("InvalidInput", {
        message: `Workflow task '${draft?.task}' is not supported in test runs.`,
      });
    }

    return {
      id: `wf_test:${createId()}`,
      name: String(draft.name),
      description: draft.description ?? undefined,
      task: expectedTask,
      version: 1 as const,
      steps: draft.steps,
    };
  }
}
