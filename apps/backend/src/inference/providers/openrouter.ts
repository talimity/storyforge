import { config } from "@storyforge/config";
import type {
  ChatCompletionRequest,
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

  async generate(request: ChatCompletionRequest): Promise<GenerationResult> {
    const openRouterRequest = this.buildRequest(request, false);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(openRouterRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        );
      }

      const data = (await response.json()) as OpenRouterResponse;

      if (!data.choices?.[0]) {
        throw new Error("No choices returned from OpenRouter API");
      }

      return {
        text: data.choices[0].message.content,
        metadata: {
          model: openRouterRequest.model,
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
    request: ChatCompletionRequest
  ): AsyncIterable<GenerationResultDelta, GenerationResult> {
    const openRouterRequest = this.buildRequest(request, true);
    let accumulatedText = "";

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(openRouterRequest),
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
              } catch (_parseError) {}
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return {
        text: accumulatedText,
        metadata: {
          model: openRouterRequest.model,
          provider: "openrouter",
        },
      };
    } catch (error) {
      throw new Error(
        `OpenRouter streaming failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  renderPrompt(request: ChatCompletionRequest): string {
    return JSON.stringify(this.buildRequest(request, false), null, 2);
  }

  private buildRequest(
    request: ChatCompletionRequest,
    stream: boolean
  ): OpenRouterRequest {
    const messages: OpenRouterMessage[] = request.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    const { parameters } = request;

    const openRouterRequest: OpenRouterRequest = {
      model: request.model,
      messages,
      stream,
    };

    if (parameters.temperature !== undefined) {
      openRouterRequest.temperature = parameters.temperature;
    }

    if (parameters.maxTokens !== undefined) {
      openRouterRequest.max_tokens = parameters.maxTokens;
    }

    if (parameters.stopSequences && parameters.stopSequences.length > 0) {
      openRouterRequest.stop = parameters.stopSequences;
    }

    return openRouterRequest;
  }
}
