import type {
  CreateModelProfile,
  CreateProviderConfig,
  UpdateModelProfile,
  UpdateProviderConfig,
} from "@storyforge/contracts";
import {
  buildSqliteUpdates,
  type ModelProfile,
  modelProfiles,
  type NewProviderConfig,
  type ProviderConfig,
  providerConfigs,
  type SqliteDatabase,
  type SqliteTransaction,
  type SqliteTxLike,
} from "@storyforge/db";
import {
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  createAdapter,
} from "@storyforge/inference";
import { stripNulls } from "@storyforge/utils";
import { eq } from "drizzle-orm";
import { createChildLogger } from "../../logging.js";
import { ServiceError } from "../../service-error.js";
import { withTransaction } from "../../transaction-utils.js";

const logger = createChildLogger("provider-service");

export class ProviderService {
  constructor(private db: SqliteDatabase) {}

  async createProvider(input: CreateProviderConfig, outerTx?: SqliteTransaction) {
    const op = async (tx: SqliteTransaction) => {
      ensureOpenAICompatibleRequirements({
        kind: input.kind,
        baseUrl: input.baseUrl,
        capabilities: input.capabilities,
      });

      const newProvider: NewProviderConfig = {
        ...input,
        capabilities: resolveCapabilitiesForKind(input.kind, input.capabilities),
      };

      const [created] = await tx.insert(providerConfigs).values(newProvider).returning();

      return created;
    };

    return withTransaction(this.db, outerTx, op);
  }

  async updateProvider(
    id: string,
    input: UpdateProviderConfig["data"],
    outerTx?: SqliteTransaction
  ): Promise<ProviderConfig> {
    const op = async (tx: SqliteTransaction) => {
      const existing = await this.getProviderByIdOrFail(tx, id);

      const newKind = input.kind ?? existing.kind;
      ensureOpenAICompatibleRequirements({
        kind: newKind,
        baseUrl: input.baseUrl ?? existing.baseUrl,
        capabilities: input.capabilities ?? existing.capabilities,
      });

      const updates = buildSqliteUpdates({
        input,
        table: providerConfigs,
        jsonKeys: ["auth", "capabilities"],
      });

      const [updated] = await tx
        .update(providerConfigs)
        .set(updates)
        .where(eq(providerConfigs.id, id))
        .returning();

      return updated;
    };

    return withTransaction(this.db, outerTx, op);
  }

  async deleteProvider(id: string, outerTx?: SqliteTransaction): Promise<void> {
    const op = async (tx: SqliteTransaction) => {
      // Check if provider exists
      await this.getProviderByIdOrFail(tx, id);

      // Delete will cascade to model profiles due to FK constraint
      await tx.delete(providerConfigs).where(eq(providerConfigs.id, id));
    };

    return withTransaction(this.db, outerTx, op);
  }

  async createModelProfile(
    input: CreateModelProfile,
    outerTx?: SqliteTransaction
  ): Promise<ModelProfile> {
    const op = async (tx: SqliteTransaction) => {
      await this.getProviderByIdOrFail(tx, input.providerId);

      const [created] = await tx.insert(modelProfiles).values(input).returning();
      return created;
    };

    return withTransaction(this.db, outerTx, op);
  }

  async updateModelProfile(
    id: string,
    input: UpdateModelProfile,
    outerTx?: SqliteTransaction
  ): Promise<ModelProfile> {
    const op = async (tx: SqliteTransaction) => {
      await this.getModelProfileByIdOrFail(tx, id);

      // If changing provider, verify new provider exists
      if (input.providerId) {
        await this.getProviderByIdOrFail(tx, input.providerId);
      }

      const updates = buildSqliteUpdates({
        input,
        table: modelProfiles,
        jsonKeys: ["capabilityOverrides"],
      });

      const [updated] = await tx
        .update(modelProfiles)
        .set(updates)
        .where(eq(modelProfiles.id, id))
        .returning();

      return updated;
    };

    return withTransaction(this.db, outerTx, op);
  }

  async deleteModelProfile(id: string, outerTx?: SqliteTransaction): Promise<void> {
    const op = async (tx: SqliteTransaction) => {
      await this.getModelProfileByIdOrFail(tx, id);

      await tx.delete(modelProfiles).where(eq(modelProfiles.id, id));
    };

    return withTransaction(this.db, outerTx, op);
  }

  async testProviderConnection(
    id: string,
    modelProfileId: string
  ): Promise<{ success: boolean; payload: unknown }> {
    const provider = await this.getProviderByIdOrFail(this.db, id);
    const model = await this.getModelProfileByIdOrFail(this.db, modelProfileId);
    const adapter = createAdapter(stripNulls(provider)).withOverrides(model.capabilityOverrides);

    const req: ChatCompletionRequest = {
      messages: [
        {
          role: "user",
          // content: "This is an API connection test. Respond with simply 'success'.",
          content: "What color is the sky?",
        },
        {
          role: "assistant",
          content: "The",
        },
      ],
      model: model.modelId,
      maxOutputTokens: 5,
      stop: [],
      genParams: { temperature: 0.1, topLogprobs: 5 },
      textTemplate: model.textTemplate ?? undefined,
    };

    let result: ChatCompletionResponse;
    if (adapter.effectiveCapabilities().streaming) {
      const gen = adapter.completeStream(req);
      let r = await gen.next();
      while (!r.done) r = await gen.next();
      result = r.value;
    } else {
      result = await adapter.complete(req);
    }

    logger.info({ result }, "Provider connection test result");

    if (!result.message.content.length && !result.reasoningContent?.length) {
      throw new ServiceError("InternalError", {
        message: "Connected to provider, but model returned an empty response.",
      });
    }

    return { success: true, payload: result };
  }

  private async getModelProfileByIdOrFail(tx: SqliteTxLike, id: string) {
    const [model] = await tx.select().from(modelProfiles).where(eq(modelProfiles.id, id)).limit(1);
    if (!model) {
      throw new ServiceError("NotFound", {
        message: `Model profile ${id} not found`,
      });
    }
    return model;
  }

  private async getProviderByIdOrFail(tx: SqliteTxLike, id: string) {
    const [provider] = await tx
      .select()
      .from(providerConfigs)
      .where(eq(providerConfigs.id, id))
      .limit(1);
    if (!provider) {
      throw new ServiceError("NotFound", {
        message: `Provider ${id} not found`,
      });
    }
    return provider;
  }
}

function ensureOpenAICompatibleRequirements(args: {
  kind: ProviderConfig["kind"];
  baseUrl: string | null | undefined;
  capabilities: ProviderConfig["capabilities"] | null | undefined;
}) {
  if (args.kind !== "openai-compatible") return;

  if (!args.baseUrl) {
    throw new ServiceError("InvalidInput", {
      message: "Base URL is required for OpenAI-compatible provider",
    });
  }

  if (!args.capabilities) {
    throw new ServiceError("InvalidInput", {
      message: "Capabilities are required for OpenAI-compatible provider",
    });
  }
}

function resolveCapabilitiesForKind(
  kind: ProviderConfig["kind"],
  capabilities: ProviderConfig["capabilities"] | null | undefined
): ProviderConfig["capabilities"] | null {
  if (kind !== "openai-compatible") {
    return null;
  }

  if (!capabilities) {
    throw new ServiceError("InvalidInput", {
      message: "Capabilities are required for OpenAI-compatible provider",
    });
  }

  return capabilities;
}
