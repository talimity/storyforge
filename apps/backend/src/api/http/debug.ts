import { FastifyInstance } from "fastify";
import { OpenRouterProvider } from "@/inference/providers/openrouter";

interface ModelsQuery {
  filter?: string;
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
  stream?: boolean;
}

export async function debugRoutes(fastify: FastifyInstance) {
  let openRouterProvider: OpenRouterProvider;
  
  try {
    openRouterProvider = new OpenRouterProvider();
  } catch (error) {
    fastify.log.warn("OpenRouter provider not configured:", error);
  }

  fastify.get<{ Querystring: ModelsQuery }>("/debug/models", async (request) => {
    if (!openRouterProvider) {
      throw new Error("OpenRouter provider not configured");
    }

    try {
      const { filter } = request.query;
      const models = await openRouterProvider.listModels(filter);
      return { models, count: models.length };
    } catch (error) {
      fastify.log.error("Failed to list models:", error);
      throw new Error("Failed to list models");
    }
  });

  fastify.post<{ Body: CompletionBody }>("/debug/completion", async (request, reply) => {
    if (!openRouterProvider) {
      throw new Error("OpenRouter provider not configured");
    }

    const { sections = [], parameters = {}, model = "openai/gpt-4o", stream = false } = request.body;

    const context = {
      sections: sections.length > 0 ? sections : [
        {
          id: "default-system",
          content: "You are a helpful AI assistant.",
          metadata: { role: "system" as const }
        },
        {
          id: "default-task", 
          content: "Please respond to this test message.",
          metadata: { role: "task" as const }
        }
      ],
      parameters: {
        maxTokens: parameters.maxTokens || 150,
        temperature: parameters.temperature || 0.7,
        stopSequences: parameters.stopSequences || []
      },
      model
    };

    try {
      if (stream) {
        reply.header("Content-Type", "text/event-stream");
        reply.header("Cache-Control", "no-cache");
        reply.header("Connection", "keep-alive");

        for await (const delta of openRouterProvider.generateStream(context)) {
          if (delta.text) {
            reply.raw.write(`data: ${JSON.stringify({ text: delta.text })}\n\n`);
          }
        }
        
        reply.raw.write("data: [DONE]\n\n");
        reply.raw.end();
        return;
      } else {
        const result = await openRouterProvider.generate(context);
        return {
          text: result.text,
          metadata: result.metadata,
          prompt: openRouterProvider.renderPrompt(context)
        };
      }
    } catch (error) {
      fastify.log.error("Completion failed:", error);
      throw new Error(`Completion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  fastify.get("/debug/render-prompt", async () => {
    if (!openRouterProvider) {
      throw new Error("OpenRouter provider not configured");
    }

    const context = {
      sections: [
        {
          id: "example-system",
          content: "You are a creative storyteller.",
          metadata: { role: "system" as const }
        },
        {
          id: "example-reference",
          content: "The story takes place in a medieval fantasy world.",
          metadata: { role: "reference" as const }
        },
        {
          id: "example-history",
          content: "Previously, the hero entered the dark forest.",
          metadata: { role: "history" as const }
        },
        {
          id: "example-task",
          content: "Continue the story with the hero encountering a mysterious stranger.",
          metadata: { role: "task" as const }
        }
      ],
      parameters: {
        maxTokens: 200,
        temperature: 0.8
      },
      model: "openai/gpt-4o"
    };

    const rendered = openRouterProvider.renderPrompt(context);
    return {
      context,
      rendered,
      provider: openRouterProvider.name
    };
  });
}
