import type {
  ModelProfile,
  NewModelProfile,
  NewProviderConfig,
  ProviderConfig,
  SqliteDatabase,
  SqliteTransaction,
} from "@storyforge/db";
import { modelProfiles, providerConfigs } from "@storyforge/db";
import type {
  CreateModelProfile,
  CreateProviderConfig,
  UpdateModelProfile,
  UpdateProviderConfig,
} from "@storyforge/schemas";
import { eq } from "drizzle-orm";
import { ServiceError } from "@/service-error";

export class ProviderService {
  constructor(private db: SqliteDatabase) {}

  async createProvider(
    input: CreateProviderConfig,
    outerTx?: SqliteTransaction
  ) {
    const op = async (tx: SqliteTransaction) => {
      if (input.kind === "openai-compatible" && !input.baseUrl) {
        throw new ServiceError("InvalidInput", {
          message: "Base URL is required for OpenAI-compatible providers",
        });
      }

      const newProvider: NewProviderConfig = {
        kind: input.kind,
        name: input.name,
        auth: input.auth,
        baseUrl: input.baseUrl,
        // TODO: Add capabilities once we update the schema
      };

      const [created] = await tx
        .insert(providerConfigs)
        .values(newProvider)
        .returning();

      return created;
    };

    return outerTx ? op(outerTx) : this.db.transaction(op);
  }

  async updateProvider(
    id: string,
    input: UpdateProviderConfig,
    outerTx?: SqliteTransaction
  ): Promise<ProviderConfig> {
    const op = async (tx: SqliteTransaction) => {
      const existing = await this.getProviderByIdOrFail(tx, id);

      const newKind = input.kind ?? existing.kind;
      if (newKind === "openai-compatible") {
        const newBaseUrl = input.baseUrl ?? existing.baseUrl;
        if (!newBaseUrl) {
          throw new ServiceError("InvalidInput", {
            message: "Base URL is required for OpenAI-compatible providers",
          });
        }
      }

      const updates: Partial<NewProviderConfig> = {};
      if (input.kind !== undefined) updates.kind = input.kind;
      if (input.name !== undefined) updates.name = input.name;
      if (input.auth !== undefined) updates.auth = input.auth;
      if (input.baseUrl !== undefined) updates.baseUrl = input.baseUrl;

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

      const newModel: NewModelProfile = {
        providerId: input.providerId,
        displayName: input.displayName,
        modelId: input.modelId,
        // TODO: Add capability overrides once we update the schema
      };

      const [created] = await tx
        .insert(modelProfiles)
        .values(newModel)
        .returning();
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

      const updates: Partial<NewModelProfile> = {};
      if (input.providerId !== undefined) updates.providerId = input.providerId;
      if (input.displayName !== undefined)
        updates.displayName = input.displayName;
      if (input.modelId !== undefined) updates.modelId = input.modelId;

      const [updated] = await tx
        .update(modelProfiles)
        .set(updates)
        .where(eq(modelProfiles.id, id))
        .returning();

      return updated;
    };

    return outerTx ? op(outerTx) : this.db.transaction(op);
  }

  async deleteModelProfile(
    id: string,
    outerTx?: SqliteTransaction
  ): Promise<void> {
    const op = async (tx: SqliteTransaction) => {
      // Check if model profile exists
      await this.getModelProfileByIdOrFail(tx, id);

      await tx.delete(modelProfiles).where(eq(modelProfiles.id, id));
    };

    return outerTx ? op(outerTx) : this.db.transaction(op);
  }

  async testProviderConnection(
    id: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const provider = await this.getProviderByIdOrFail(this.db, id);

    // TODO: Implement actual connection testing once we have provider adapters
    // For now, just simulate a successful test
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay

    const auth = provider.auth;
    if (!auth.apiKey) {
      return { success: false, error: "API key is not configured" };
    }

    return { success: true, message: "Connection successful" };
  }

  private async getModelProfileByIdOrFail(tx: SqliteTransaction, id: string) {
    const [model] = await tx
      .select()
      .from(modelProfiles)
      .where(eq(modelProfiles.id, id))
      .limit(1);
    if (!model) {
      throw new ServiceError("NotFound", {
        message: `Model profile ${id} not found`,
      });
    }
    return model;
  }

  private async getProviderByIdOrFail(
    tx: SqliteTransaction | SqliteDatabase,
    id: string
  ) {
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
