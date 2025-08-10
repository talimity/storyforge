import { type CompletionInput, completionSchema } from "@storyforge/api";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { generationContextAdapter } from "@/inference/generation-context-adapter";
import type { LLMProvider } from "@/inference/providers/base-provider";
import { DeepSeekProvider } from "@/inference/providers/deepseek";
import { MockProvider } from "@/inference/providers/mock";
import { OpenRouterProvider } from "@/inference/providers/openrouter";

// Initialize providers (reusing the same logic as debug router)
const providers = new Map<string, LLMProvider>();
providers.set("mock", new MockProvider());

try {
  providers.set("openrouter", new OpenRouterProvider());
} catch (error) {
  // biome-ignore lint/plugin/noConsole: placeholder code
  console.warn("OpenRouter provider not configured:", error);
}

try {
  providers.set("deepseek", new DeepSeekProvider());
} catch (error) {
  // biome-ignore lint/plugin/noConsole: placeholder code
  console.warn("DeepSeek provider not configured:", error);
}

async function completionStreamHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  let input: CompletionInput;
  try {
    input = completionSchema.parse(request.body);
  } catch (error) {
    reply.code(400).send({ error: "Invalid input", details: error });
    return;
  }

  const {
    sections = [],
    parameters = {},
    model = "mock-default",
    provider = "mock",
  } = input;

  const llmProvider = providers.get(provider);
  if (!llmProvider) {
    reply.code(400).send({ error: `Provider '${provider}' not available` });
    return;
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

  const chatRequest = generationContextAdapter.toChatCompletionRequest(context);

  const streamGenerator = async function* () {
    try {
      yield {
        event: "start",
        data: JSON.stringify({
          provider,
          model,
          parameters: context.parameters,
          prompt: llmProvider.renderPrompt(chatRequest),
        }),
      };

      let fullText = "";

      for await (const delta of llmProvider.generateStream(chatRequest)) {
        if (delta.text) {
          fullText += delta.text;
          yield {
            event: "delta",
            data: JSON.stringify({
              delta: delta.text,
              fullText,
            }),
          };
        }
      }

      yield {
        event: "complete",
        data: JSON.stringify({
          text: fullText,
          provider,
          model,
        }),
      };
    } catch (error) {
      yield {
        event: "error",
        data: JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  };

  reply.sse(streamGenerator());
}

/**
 * Register SSE routes for streaming completions
 */
export function registerSSERoutes(fastify: FastifyInstance) {
  fastify.post(
    "/api/debug/completion/stream",
    {
      schema: {
        description: "Stream text completion via Server-Sent Events",
        tags: ["debug", "streaming"],
        body: {
          type: "object",
          properties: {
            provider: { type: "string" },
            model: { type: "string" },
            parameters: {
              type: "object",
              properties: {
                maxTokens: { type: "number" },
                temperature: { type: "number" },
                stopSequences: { type: "array", items: { type: "string" } },
              },
            },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  content: { type: "string" },
                  metadata: {
                    type: "object",
                    properties: {
                      role: {
                        type: "string",
                        enum: ["system", "reference", "history", "task"],
                      },
                      priority: { type: "number" },
                    },
                  },
                },
                required: ["id", "content"],
              },
            },
          },
        },
        response: {
          200: {
            type: "string",
            description: "SSE stream of completion events",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              details: {},
            },
            required: ["error"],
          },
        },
      },
    },
    completionStreamHandler
  );
}
