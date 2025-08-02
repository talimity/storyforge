import { config } from "../../config";
import {
  GenerationContext,
  GenerationContextSectionRole,
  GenerationResult,
  GenerationResultDelta,
  LLMProvider,
  ProviderCapabilities,
} from "./base-provider";

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string[];
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface OpenRouterStreamDelta {
  choices: Array<{
    delta: {
      content?: string;
    };
  }>;
}

interface OpenRouterModel {
  id: string;
  name?: string;
  description?: string;
}

export class OpenRouterProvider implements LLMProvider {
  readonly id = "openrouter";
  readonly name = "OpenRouter";
  private readonly apiKey: string;
  private readonly baseUrl = "https://openrouter.ai/api/v1";

  constructor() {
    if (!config.llm.openrouter?.apiKey) {
      throw new Error("OpenRouter API key not configured");
    }
    this.apiKey = config.llm.openrouter.apiKey;
  }

  get capabilities(): ProviderCapabilities {
    return {
      supportsPrefill: false,
      supportsStreaming: true,
      supportedParameters: new Set([
        "maxTokens",
        "temperature",
        "stopSequences",
      ]),
    };
  }

  async listModels(filter?: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch models: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as { data: OpenRouterModel[] };
      let models = data.data.map((model) => model.id);

      if (filter) {
        const filterLower = filter.toLowerCase();
        models = models.filter((id) => id.toLowerCase().includes(filterLower));
      }

      return models.sort();
    } catch (error) {
      throw new Error(
        `Failed to list OpenRouter models: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async generate(context: GenerationContext): Promise<GenerationResult> {
    const request = this.buildRequest(context, false);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        );
      }

      const data = (await response.json()) as OpenRouterResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new Error("No choices returned from OpenRouter API");
      }

      return {
        text: data.choices[0]!.message.content,
        metadata: {
          model: request.model,
          provider: "openrouter",
        },
      };
    } catch (error) {
      throw new Error(
        `OpenRouter generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async *generateStream(
    context: GenerationContext
  ): AsyncIterable<GenerationResultDelta, GenerationResult> {
    const request = this.buildRequest(context, true);
    let accumulatedText = "";

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        );
      }

      if (!response.body) {
        throw new Error("No response body for streaming");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim() !== "");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data.includes("[DONE]")) continue;

              try {
                const json = JSON.parse(data) as OpenRouterStreamDelta;
                const content = json.choices[0]?.delta?.content;
                if (content) {
                  accumulatedText += content;
                  yield { text: content };
                }
              } catch (parseError) {
                // Skip malformed JSON chunks
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Return the complete result after streaming
      return {
        text: accumulatedText,
        metadata: {
          model: request.model,
          provider: "openrouter",
        },
      };
    } catch (error) {
      throw new Error(
        `OpenRouter streaming failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  renderPrompt(context: GenerationContext): string {
    return JSON.stringify(this.buildRequest(context, false), null, 2);
  }

  private buildRequest(
    context: GenerationContext,
    stream: boolean
  ): OpenRouterRequest {
    const messages = this.renderMessages(context);
    const { parameters } = context;

    const request: OpenRouterRequest = {
      model: context.model,
      messages,
      stream,
    };

    if (parameters.temperature !== undefined) {
      request.temperature = parameters.temperature;
    }

    if (parameters.maxTokens !== undefined) {
      request.max_tokens = parameters.maxTokens;
    }

    if (parameters.stopSequences && parameters.stopSequences.length > 0) {
      request.stop = parameters.stopSequences;
    }

    return request;
  }

  private renderMessages(context: GenerationContext): OpenRouterMessage[] {
    const messages: OpenRouterMessage[] = [];

    // Sort sections by role priority: system -> reference -> history -> task
    const rolePriority: Record<GenerationContextSectionRole, number> = {
      system: 0,
      reference: 1,
      history: 2,
      task: 3,
    };
    const sortedSections = [...context.sections].sort((a, b) => {
      const aPriority = a.metadata?.role ? rolePriority[a.metadata.role] : 999;
      const bPriority = b.metadata?.role ? rolePriority[b.metadata.role] : 999;
      return aPriority - bPriority;
    });

    for (const section of sortedSections) {
      const role = this.mapSectionRole(section.metadata?.role);
      messages.push({
        role,
        content: section.content,
      });
    }

    // Ensure we have at least one user message for the API
    if (messages.length === 0 || !messages.some((m) => m.role === "user")) {
      messages.push({
        role: "user",
        content: "Please respond.",
      });
    }

    return messages;
  }

  private mapSectionRole(
    role?: "system" | "reference" | "history" | "task"
  ): "system" | "user" | "assistant" {
    switch (role) {
      case "system":
        return "system";
      case "reference":
      case "history":
      case "task":
      default:
        return "user";
    }
  }
}
