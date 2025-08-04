import {
  completionResponseSchema,
  completionSchema,
  modelsQuerySchema,
  modelsResponseSchema,
  renderPromptQuerySchema,
  renderPromptResponseSchema,
} from "@storyforge/api";
import { generationContextAdapter } from "../../inference/generation-context-adapter";
import type { LLMProvider } from "../../inference/providers/base-provider";
import { DeepSeekProvider } from "../../inference/providers/deepseek";
import { MockProvider } from "../../inference/providers/mock";
import { OpenRouterProvider } from "../../inference/providers/openrouter";
import { publicProcedure, router } from "../index";

// Initialize providers
// TODO: Set up a proper configuration system for providers
const providers = new Map<string, LLMProvider>();
providers.set("mock", new MockProvider());

try {
  providers.set("openrouter", new OpenRouterProvider());
} catch (error) {
  console.warn("OpenRouter provider not configured:", error);
}

try {
  providers.set("deepseek", new DeepSeekProvider());
} catch (error) {
  console.warn("DeepSeek provider not configured:", error);
}

export const debugRouter = router({
  listModels: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/debug/models",
        tags: ["debug"],
        summary: "List available models",
      },
    })
    .input(modelsQuerySchema)
    .output(modelsResponseSchema)
    .query(async ({ input }) => {
      const { filter, provider } = input;

      if (provider) {
        const llmProvider = providers.get(provider);
        if (!llmProvider) {
          throw new Error(`Provider '${provider}' not available`);
        }

        const models = await llmProvider.listModels(filter);
        return {
          models,
          count: models.length,
          provider,
        };
      }

      const allModels: { provider: string; models: string[] }[] = [];
      for (const [providerName, llmProvider] of providers) {
        try {
          const models = await llmProvider.listModels(filter);
          allModels.push({ provider: providerName, models });
        } catch (error) {
          console.warn(`Failed to list ${providerName} models:`, error);
        }
      }

      return { providers: allModels };
    }),

  // Regular completion (non-streaming)
  completion: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/debug/completion",
        tags: ["debug"],
        summary: "Generate text completion",
      },
    })
    .input(completionSchema)
    .output(completionResponseSchema)
    .mutation(async ({ input }) => {
      const {
        sections = [],
        parameters = {},
        model = "mock-default",
        provider = "mock",
      } = input;

      const llmProvider = providers.get(provider);
      if (!llmProvider) {
        throw new Error(`Provider '${provider}' not available`);
      }

      const context = {
        sections:
          sections.length > 0
            ? sections.map((s) => {
                const section: {
                  id: string;
                  content: string;
                  metadata?: {
                    role?: "system" | "reference" | "history" | "task";
                    priority?: number;
                  };
                } = {
                  id: s.id,
                  content: s.content,
                };
                if (s.metadata) {
                  section.metadata = {};
                  if (s.metadata.role !== undefined) {
                    section.metadata.role = s.metadata.role;
                  }
                  if (s.metadata.priority !== undefined) {
                    section.metadata.priority = s.metadata.priority;
                  }
                }
                return section;
              })
            : [
                {
                  id: "default-system",
                  content: "You are a helpful AI assistant.",
                  metadata: { role: "system" as const },
                },
                {
                  id: "default-task",
                  content: "Please respond to this test message.",
                  metadata: { role: "task" as const },
                },
              ],
        parameters: {
          maxTokens: parameters.maxTokens || 150,
          temperature: parameters.temperature || 0.7,
          stopSequences: parameters.stopSequences || [],
        },
        model,
      };

      const chatRequest =
        generationContextAdapter.toChatCompletionRequest(context);
      const result = await llmProvider.generate(chatRequest);

      return {
        text: result.text,
        metadata: result.metadata,
        prompt: llmProvider.renderPrompt(chatRequest),
        provider,
      };
    }),

  // Streaming completion using tRPC subscriptions
  completionStream: publicProcedure
    .input(completionSchema)
    .subscription(async function* ({ input }) {
      const {
        sections = [],
        parameters = {},
        model = "mock-default",
        provider = "mock",
      } = input;

      const llmProvider = providers.get(provider);
      if (!llmProvider) {
        throw new Error(`Provider '${provider}' not available`);
      }

      const context = {
        sections:
          sections.length > 0
            ? sections.map((s) => {
                const section: {
                  id: string;
                  content: string;
                  metadata?: {
                    role?: "system" | "reference" | "history" | "task";
                    priority?: number;
                  };
                } = {
                  id: s.id,
                  content: s.content,
                };
                if (s.metadata) {
                  section.metadata = {};
                  if (s.metadata.role !== undefined) {
                    section.metadata.role = s.metadata.role;
                  }
                  if (s.metadata.priority !== undefined) {
                    section.metadata.priority = s.metadata.priority;
                  }
                }
                return section;
              })
            : [
                {
                  id: "default-system",
                  content: "You are a helpful AI assistant.",
                  metadata: { role: "system" as const },
                },
                {
                  id: "default-task",
                  content: "Please respond to this test message.",
                  metadata: { role: "task" as const },
                },
              ],
        parameters: {
          maxTokens: parameters.maxTokens || 150,
          temperature: parameters.temperature || 0.7,
          stopSequences: parameters.stopSequences || [],
        },
        model,
      };

      const chatRequest =
        generationContextAdapter.toChatCompletionRequest(context);

      for await (const delta of llmProvider.generateStream(chatRequest)) {
        if (delta.text) {
          yield { text: delta.text };
        }
      }
    }),

  renderPrompt: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/debug/render-prompt",
        tags: ["debug"],
        summary: "Render a prompt to see formatting",
      },
    })
    .input(renderPromptQuerySchema)
    .output(renderPromptResponseSchema)
    .query(async ({ input }) => {
      const { provider = "mock", model = "mock-default" } = input;

      const llmProvider = providers.get(provider);
      if (!llmProvider) {
        throw new Error(`Provider '${provider}' not available`);
      }

      const context = {
        sections: [
          {
            id: "example-system",
            content: "You are a creative storyteller.",
            metadata: { role: "system" as const },
          },
          {
            id: "example-reference",
            content: "The story takes place in a medieval fantasy world.",
            metadata: { role: "reference" as const },
          },
          {
            id: "example-history",
            content: "Previously, the hero entered the dark forest.",
            metadata: { role: "history" as const },
          },
          {
            id: "example-task",
            content:
              "Continue the story with the hero encountering a mysterious stranger.",
            metadata: { role: "task" as const },
          },
        ],
        parameters: {
          maxTokens: 200,
          temperature: 0.8,
        },
        model,
      };

      const chatRequest =
        generationContextAdapter.toChatCompletionRequest(context);
      const rendered = llmProvider.renderPrompt(chatRequest);

      return {
        context,
        chatRequest,
        rendered,
        provider: llmProvider.name,
      };
    }),
});
