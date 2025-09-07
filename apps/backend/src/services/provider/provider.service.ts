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
import type {
  CreateModelProfile,
  CreateProviderConfig,
  UpdateModelProfile,
  UpdateProviderConfig,
} from "@storyforge/schemas";
import { stripNulls } from "@storyforge/utils";
import { eq } from "drizzle-orm";
import { createChildLogger } from "../../logging.js";
import { ServiceError } from "../../service-error.js";

const logger = createChildLogger("provider-service");

export class ProviderService {
  constructor(private db: SqliteDatabase) {}

  async createProvider(input: CreateProviderConfig, outerTx?: SqliteTransaction) {
    const op = async (tx: SqliteTransaction) => {
      if (input.kind === "openai-compatible") {
        if (!input.baseUrl) {
          throw new ServiceError("InvalidInput", {
            message: "Base URL is required for OpenAI-compatible provider",
          });
        }
        if (!input.capabilities) {
          throw new ServiceError("InvalidInput", {
            message: "Capabilities are required for OpenAI-compatible provider",
          });
        }
      }

      const newProvider: NewProviderConfig = {
        ...input,
        ...(input.kind === "openai-compatible"
          ? { capabilities: input.capabilities }
          : { capabilities: null }),
      };

      const [created] = await tx.insert(providerConfigs).values(newProvider).returning();

      return created;
    };

    return outerTx ? op(outerTx) : this.db.transaction(op);
  }

  async updateProvider(
    id: string,
    input: UpdateProviderConfig["data"],
    outerTx?: SqliteTransaction
  ): Promise<ProviderConfig> {
    const op = async (tx: SqliteTransaction) => {
      const existing = await this.getProviderByIdOrFail(tx, id);

      const newKind = input.kind ?? existing.kind;
      if (newKind === "openai-compatible") {
        const newBaseUrl = input.baseUrl ?? existing.baseUrl;
        if (!newBaseUrl) {
          throw new ServiceError("InvalidInput", {
            message: "Base URL is required for OpenAI-compatible provider",
          });
        }
        const newCapabilities = input.capabilities ?? existing.capabilities;
        if (!newCapabilities) {
          throw new ServiceError("InvalidInput", {
            message: "Capabilities are required for OpenAI-compatible provider",
          });
        }
      }

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

    return outerTx ? op(outerTx) : this.db.transaction(op);
  }

  async deleteProvider(id: string, outerTx?: SqliteTransaction): Promise<void> {
    const op = async (tx: SqliteTransaction) => {
      // Check if provider exists
      await this.getProviderByIdOrFail(tx, id);

      // Delete will cascade to model profiles due to FK constraint
      await tx.delete(providerConfigs).where(eq(providerConfigs.id, id));
    };

    return outerTx ? op(outerTx) : this.db.transaction(op);
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

    return outerTx ? op(outerTx) : this.db.transaction(op);
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

    return outerTx ? op(outerTx) : this.db.transaction(op);
  }

  async deleteModelProfile(id: string, outerTx?: SqliteTransaction): Promise<void> {
    const op = async (tx: SqliteTransaction) => {
      await this.getModelProfileByIdOrFail(tx, id);

      await tx.delete(modelProfiles).where(eq(modelProfiles.id, id));
    };

    return outerTx ? op(outerTx) : this.db.transaction(op);
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
          content: "This is an API connection test. Respond with simply 'success'.",
        },
      ],
      model: model.modelId,
      maxOutputTokens: 5,
      stop: [],
      genParams: { temperature: 0.1, topLogprobs: 5 },
    };

    let result: ChatCompletionResponse;
    if (adapter.defaultCapabilities().streaming) {
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
