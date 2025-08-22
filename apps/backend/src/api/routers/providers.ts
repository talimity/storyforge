import type { ProviderConfig as DbProviderConfig } from "@storyforge/db";
import { createAdapter } from "@storyforge/inference";
import {
  type ProviderConfig as ApiProviderConfig,
  createModelProfileSchema,
  createProviderConfigSchema,
  listModelProfilesOutputSchema,
  listProvidersOutputSchema,
  modelProfileSchema,
  providerConfigSchema,
  searchModelsInputSchema,
  searchModelsOutputSchema,
  testProviderConnectionInputSchema,
  testProviderConnectionOutputSchema,
  updateModelProfileSchema,
  updateProviderConfigSchema,
} from "@storyforge/schemas";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "@/api/index";
import {
  getModelProfileById,
  getProviderById,
  listModelProfiles,
  listProviders,
} from "@/services/provider/provider.queries";
import { ProviderService } from "@/services/provider/provider.service";

function mapProvider(provider: DbProviderConfig): ApiProviderConfig {
  return {
    ...provider,
    auth: { hasApiKey: Boolean(provider.auth?.apiKey) },
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
    .input(
      z.object({
        id: z.string(),
        data: updateProviderConfigSchema,
      })
    )
    .output(providerConfigSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new ProviderService(ctx.db);
      const updatedProvider = await service.updateProvider(
        input.id,
        input.data
      );
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
        summary: "Test a provider's connection",
      },
    })
    .input(testProviderConnectionInputSchema)
    .output(testProviderConnectionOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new ProviderService(ctx.db);
      return await service.testProviderConnection(input.providerId);
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
      return { models };
    }),

  // Model Profile CRUD operations
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
      return { modelProfiles };
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
      return await getModelProfileById(ctx.db, input.id);
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
      return await service.createModelProfile(input);
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
      return await service.updateModelProfile(input.id, input.data);
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
