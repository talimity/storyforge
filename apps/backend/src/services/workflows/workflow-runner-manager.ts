import { type SqliteDatabase, schema } from "@storyforge/db";
import {
  buildChapterSummarizationRenderOptions,
  buildTurnGenRenderOptions,
  chapterSummarizationRegistry,
  makeWorkflowRunner,
  type TaskKind,
  turnGenRegistry,
  type WorkflowRunner,
} from "@storyforge/gentasks";
import {
  createAdapter,
  type ProviderAuth,
  type ProviderConfig,
  textInferenceCapabilitiesSchema,
} from "@storyforge/inference";
import {
  type BudgetManager,
  DefaultBudgetManager,
  type UnboundTemplate,
} from "@storyforge/prompt-rendering";
import { assertNever } from "@storyforge/utils";
import { eq } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { fromDbPromptTemplate } from "../template/utils/marshalling.js";

/**
 * Singleton to manage workflow runners for different task kinds.
 */
export class WorkflowRunnerManager {
  private static instance: WorkflowRunnerManager | null = null;
  private runners = new Map<TaskKind, WorkflowRunner<TaskKind>>();

  private constructor(private db: SqliteDatabase) {}

  /**
   * Gets or creates the singleton instance
   */
  static getInstance(db: SqliteDatabase): WorkflowRunnerManager {
    if (!WorkflowRunnerManager.instance) {
      WorkflowRunnerManager.instance = new WorkflowRunnerManager(db);
    }
    return WorkflowRunnerManager.instance;
  }

  /**
   * Gets or creates a workflow runner for the specified task kind
   */
  getRunner<K extends TaskKind>(taskKind: K): WorkflowRunner<K> {
    if (this.runners.has(taskKind)) {
      return this.runners.get(taskKind) as WorkflowRunner<K>;
    }

    switch (taskKind) {
      case "turn_generation": {
        const registry = turnGenRegistry;
        const runner = makeWorkflowRunner<"turn_generation">({
          loadTemplate: (id) => this.loadTemplate(id),
          loadModelProfile: (id) => this.loadModelProfile(id),
          budgetFactory: (maxTokens) => this.createBudgetManager(maxTokens),
          makeAdapter: createAdapter,
          registry: registry,
          resolveRenderOptions: ({ extendedContext }) => buildTurnGenRenderOptions(extendedContext),
        });

        this.runners.set(taskKind, runner as WorkflowRunner<TaskKind>);
        return runner as WorkflowRunner<K>;
      }

      case "chapter_summarization": {
        const registry = chapterSummarizationRegistry;
        const runner = makeWorkflowRunner<"chapter_summarization">({
          loadTemplate: (id) => this.loadTemplate(id),
          loadModelProfile: (id) => this.loadModelProfile(id),
          budgetFactory: (maxTokens) => this.createBudgetManager(maxTokens),
          makeAdapter: createAdapter,
          registry: registry,
          resolveRenderOptions: ({ extendedContext }) =>
            buildChapterSummarizationRenderOptions(extendedContext),
        });

        this.runners.set(taskKind, runner as WorkflowRunner<TaskKind>);
        return runner as WorkflowRunner<K>;
      }

      case "writing_assistant":
        // Writing assistant workflows are not yet supported by the tester
        // fallback to thrown error until implemented.
        throw new Error("Not implemented");
      default:
        assertNever(taskKind);
    }
  }

  /**
   * Loads a prompt template from the database
   */
  private async loadTemplate(templateId: string): Promise<UnboundTemplate> {
    const dbTemplate = await this.db.query.promptTemplates.findFirst({
      where: { id: templateId },
    });

    if (!dbTemplate) {
      throw new ServiceError("NotFound", {
        message: `Prompt template with ID ${templateId} not found`,
      });
    }

    return fromDbPromptTemplate(dbTemplate);
  }

  /**
   * Loads a model profile with its provider configuration
   */
  private async loadModelProfile(profileId: string) {
    // Query model profile with provider config joined
    const result = await this.db
      .select({
        profile: schema.modelProfiles,
        provider: schema.providerConfigs,
      })
      .from(schema.modelProfiles)
      .innerJoin(
        schema.providerConfigs,
        eq(schema.modelProfiles.providerId, schema.providerConfigs.id)
      )
      .where(eq(schema.modelProfiles.id, profileId))
      .limit(1);

    const row = result[0];
    if (!row) {
      throw new ServiceError("NotFound", {
        message: `Model profile with ID ${profileId} not found`,
      });
    }

    // Convert database provider to ProviderConfig format, handling null baseUrl
    const providerConfig: ProviderConfig = {
      kind: row.provider.kind,
      auth: row.provider.auth as ProviderAuth,
      baseUrl: row.provider.baseUrl ?? undefined,
      // TODO: Add capabilities and genParams when schema supports them
    };

    // Parse overrides using canonical schema (partial)
    const parsed = textInferenceCapabilitiesSchema
      .partial()
      .safeParse(row.profile.capabilityOverrides);
    const overrides = parsed.success ? parsed.data : undefined;

    return {
      id: row.profile.id,
      displayName: row.profile.displayName,
      provider: providerConfig,
      providerId: row.provider.id,
      providerName: row.provider.name,
      modelId: row.profile.modelId,
      textTemplate: row.profile.textTemplate,
      modelInstruction: row.profile.modelInstruction,
      capabilityOverrides: overrides,
      defaultGenParams: undefined,
    };
  }

  /**
   * Creates a budget manager for token management
   */
  private createBudgetManager(maxTokens?: number): BudgetManager {
    return new DefaultBudgetManager(
      // TODO: fallback token budget should come from the step's model profile
      { maxTokens: maxTokens ?? 8192 },
      // Use default token estimator (~4 chars per token)
      undefined
    );
  }
}
