import type { FastifyInstance } from "fastify";
import { generationContextAdapter } from "@/inference/generation-context-adapter";
import type { LLMProvider } from "@/inference/providers/base-provider";
import { DeepSeekProvider } from "@/inference/providers/deepseek";
import { MockProvider } from "@/inference/providers/mock";
import { OpenRouterProvider } from "@/inference/providers/openrouter";

interface ModelsQuery {
  filter?: string;
  provider?: string;
}

interface CompletionBody {
  sections?: Array<{
    id: string;
    content: string;
    metadata?: {
      role?: "system" | "reference" | "history" | "task";
      priority?: number;
    };
  }>;
  parameters?: {
    maxTokens?: number;
    temperature?: number;
    stopSequences?: string[];
  };
  model?: string;
  provider?: string;
  stream?: boolean;
}

export async function debugRoutes(fastify: FastifyInstance) {
  const providers = new Map<string, LLMProvider>();

  // Mock provider is always available for testing
  providers.set("mock", new MockProvider());

  try {
    providers.set("openrouter", new OpenRouterProvider());
  } catch (error) {
    fastify.log.warn("OpenRouter provider not configured:", error);
  }

  try {
    providers.set("deepseek", new DeepSeekProvider());
  } catch (error) {
    fastify.log.warn("DeepSeek provider not configured:", error);
  }

  fastify.get<{ Querystring: ModelsQuery }>(
    "/debug/models",
    async (request) => {
      const { filter, provider: requestedProvider } = request.query;

      if (requestedProvider) {
        const provider = providers.get(requestedProvider);
        if (!provider) {
          throw new Error(`Provider '${requestedProvider}' not available`);
        }

        try {
          const models = await provider.listModels(filter);
          return {
            models,
            count: models.length,
            provider: requestedProvider,
          };
        } catch (error) {
          fastify.log.error(
            `Failed to list ${requestedProvider} models:`,
            error
          );
          throw new Error(`Failed to list ${requestedProvider} models`);
        }
      }

      const allModels: { provider: string; models: string[] }[] = [];
      for (const [providerName, provider] of providers) {
        try {
          const models = await provider.listModels(filter);
          allModels.push({ provider: providerName, models });
        } catch (error) {
          fastify.log.warn(`Failed to list ${providerName} models:`, error);
        }
      }

      return { providers: allModels };
    }
  );

  fastify.post<{ Body: CompletionBody }>(
    "/debug/completion",
    async (request, reply) => {
      const {
        sections = [],
        parameters = {},
        model = "mock-default",
        provider: requestedProvider = "mock",
        stream = false,
      } = request.body;

      const provider = providers.get(requestedProvider);
      if (!provider) {
        throw new Error(`Provider '${requestedProvider}' not available`);
      }

      const context = {
        sections:
          sections.length > 0
            ? sections
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

      try {
        if (stream) {
          reply.header("Content-Type", "text/event-stream");
          reply.header("Cache-Control", "no-cache");
          reply.header("Connection", "keep-alive");

          for await (const delta of provider.generateStream(chatRequest)) {
            if (delta.text) {
              reply.raw.write(
                `data: ${JSON.stringify({ text: delta.text })}\n\n`
              );
            }
          }

          reply.raw.write("data: [DONE]\n\n");
          reply.raw.end();
          return;
        } else {
          const result = await provider.generate(chatRequest);
          return {
            text: result.text,
            metadata: result.metadata,
            prompt: provider.renderPrompt(chatRequest),
            provider: requestedProvider,
          };
        }
      } catch (error) {
        fastify.log.error("Completion failed:", error);
        throw new Error(
          `Completion failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  fastify.get<{ Querystring: { provider?: string; model?: string } }>(
    "/debug/render-prompt",
    async (request) => {
      const { provider: requestedProvider = "mock", model = "mock-default" } =
        request.query;

      const provider = providers.get(requestedProvider);
      if (!provider) {
        throw new Error(`Provider '${requestedProvider}' not available`);
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
      const rendered = provider.renderPrompt(chatRequest);
      return {
        context,
        chatRequest,
        rendered,
        provider: provider.name,
      };
    }
  );
}
