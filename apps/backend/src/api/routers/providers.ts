import {
  type ModelProfile as ApiModelProfile,
  type ProviderConfig as ApiProviderConfig,
  createModelProfileSchema,
  createProviderConfigSchema,
  listModelProfilesOutputSchema,
  listProvidersOutputSchema,
  modelProfileSchema,
  providerConfigSchema,
  searchModelProfilesInputSchema,
  searchModelProfilesOutputSchema,
  searchModelsInputSchema,
  searchModelsOutputSchema,
  testProviderConnectionInputSchema,
  testProviderConnectionOutputSchema,
  updateModelProfileSchema,
  updateProviderConfigSchema,
} from "@storyforge/contracts";
import type {
  ModelProfile as DbModelProfile,
  ProviderConfig as DbProviderConfig,
} from "@storyforge/db";
import {
  createAdapter,
  getDefaultCapabilities,
  textInferenceCapabilitiesSchema,
} from "@storyforge/inference";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getModelProfileById,
  getProviderById,
  listModelProfiles,
  listProviders,
  searchModelProfiles,
} from "../../services/provider/provider.queries.js";
import { ProviderService } from "../../services/provider/provider.service.js";
import { publicProcedure, router } from "../index.js";

function mapProvider(provider: DbProviderConfig): ApiProviderConfig {
  const parsed = textInferenceCapabilitiesSchema.safeParse(provider.capabilities);
  return {
    ...provider,
    auth: { hasApiKey: Boolean(provider.auth?.apiKey) },
    capabilities: parsed.success ? parsed.data : getDefaultCapabilities(provider.kind),
  };
}

function mapModelProfile(model: DbModelProfile): ApiModelProfile {
  const parsed = textInferenceCapabilitiesSchema.partial().safeParse(model.capabilityOverrides);
  return {
    id: model.id,
    providerId: model.providerId,
    displayName: model.displayName,
    modelId: model.modelId,
    capabilityOverrides: parsed.success ? parsed.data : null,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  };
}

export const providersRouter = router({
  listProviders: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/providers",
        tags: ["providers"],
        summary: "List all provider configurations",
      },
    })
    .input(z.void())
    .output(listProvidersOutputSchema)
    .query(async ({ ctx }) => {
      const providers = await listProviders(ctx.db);
      return { providers: providers.map(mapProvider) };
    }),

  getProvider: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/providers/{id}",
        tags: ["providers"],
        summary: "Get a specific provider configuration",
      },
    })
    .input(z.object({ id: z.string() }))
    .output(providerConfigSchema)
    .query(async ({ input, ctx }) => {
      const provider = await getProviderById(ctx.db, input.id);
      return mapProvider(provider);
    }),

  createProvider: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/providers",
        tags: ["providers"],
        summary: "Create a new provider configuration",
      },
    })
    .input(createProviderConfigSchema)
    .output(providerConfigSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new ProviderService(ctx.db);
      const newProvider = await service.createProvider(input);
      return mapProvider(newProvider);
    }),

  updateProvider: publicProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/api/providers/{id}",
        tags: ["providers"],
        summary: "Update a provider configuration",
      },
    })
    .input(updateProviderConfigSchema)
    .output(providerConfigSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, data } = input;
      const service = new ProviderService(ctx.db);
      const updatedProvider = await service.updateProvider(id, data);
      return mapProvider(updatedProvider);
    }),

  deleteProvider: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/providers/{id}",
        tags: ["providers"],
        summary: "Delete a provider configuration",
      },
    })
    .input(z.object({ id: z.string() }))
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const service = new ProviderService(ctx.db);
      await service.deleteProvider(input.id);
    }),

  testConnection: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/providers/{providerId}/test",
        tags: ["providers"],
        summary: "Test a provider's connection with the provided model ID",
      },
    })
    .input(testProviderConnectionInputSchema)
    .output(testProviderConnectionOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const { providerId, modelProfileId } = input;
      const service = new ProviderService(ctx.db);
      return await service.testProviderConnection(providerId, modelProfileId);
    }),

  searchModels: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/providers/{providerId}/search-models",
        tags: ["providers"],
        summary: "Search for available models from a provider",
      },
    })
    .input(searchModelsInputSchema)
    .output(searchModelsOutputSchema)
    .query(async ({ input, ctx }) => {
      const provider = await getProviderById(ctx.db, input.providerId);
      if (!provider) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Provider not found",
        });
      }

      const adapter = createAdapter({
        kind: provider.kind,
        auth: provider.auth,
        baseUrl: provider.baseUrl || undefined,
      });

      const models = await adapter.searchModels(input.query);
      return {
        models: models.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          tags: [],
          contextLength: null,
        })),
      };
    }),

  // Model Profile CRUD operations
  searchModelProfiles: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/model-profiles/search",
        tags: ["model-profiles"],
        summary: "Search model profiles by name or model ID",
      },
    })
    .input(searchModelProfilesInputSchema)
    .output(searchModelProfilesOutputSchema)
    .query(async ({ input, ctx }) => {
      const items = await searchModelProfiles(ctx.db, input);
      return { modelProfiles: items.map(mapModelProfile) };
    }),
  listModelProfiles: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/model-profiles",
        tags: ["model-profiles"],
        summary: "List all model profiles",
      },
    })
    .input(z.void())
    .output(listModelProfilesOutputSchema)
    .query(async ({ ctx }) => {
      const modelProfiles = await listModelProfiles(ctx.db);
      return { modelProfiles: modelProfiles.map(mapModelProfile) };
    }),

  getModelProfile: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/model-profiles/{id}",
        tags: ["model-profiles"],
        summary: "Get a specific model profile",
      },
    })
    .input(z.object({ id: z.string() }))
    .output(modelProfileSchema)
    .query(async ({ input, ctx }) => {
      const mp = await getModelProfileById(ctx.db, input.id);
      return mapModelProfile(mp);
    }),

  createModelProfile: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/model-profiles",
        tags: ["model-profiles"],
        summary: "Create a new model profile",
      },
    })
    .input(createModelProfileSchema)
    .output(modelProfileSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new ProviderService(ctx.db);
      const created = await service.createModelProfile(input);
      return mapModelProfile(created);
    }),

  updateModelProfile: publicProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/api/model-profiles/{id}",
        tags: ["model-profiles"],
        summary: "Update a model profile",
      },
    })
    .input(
      z.object({
        id: z.string(),
        data: updateModelProfileSchema,
      })
    )
    .output(modelProfileSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new ProviderService(ctx.db);
      const updated = await service.updateModelProfile(input.id, input.data);
      return mapModelProfile(updated);
    }),

  deleteModelProfile: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/model-profiles/{id}",
        tags: ["model-profiles"],
        summary: "Delete a model profile",
      },
    })
    .input(z.object({ id: z.string() }))
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const service = new ProviderService(ctx.db);
      await service.deleteModelProfile(input.id);
    }),
});
