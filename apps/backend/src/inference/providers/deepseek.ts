import { config } from "@storyforge/config";
import type {
  ChatCompletionRequest,
  GenerationResult,
  GenerationResultDelta,
  LLMProvider,
  ProviderCapabilities,
} from "./base-provider";

interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string[];
  frequency_penalty?: number;
  presence_penalty?: number;
  top_p?: number;
}

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface DeepSeekStreamDelta {
  choices: Array<{
    delta: {
      content?: string;
    };
  }>;
}

interface DeepSeekModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export class DeepSeekProvider implements LLMProvider {
  readonly id = "deepseek";
  readonly name = "DeepSeek";
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.deepseek.com";

  constructor() {
    if (!config.llm.deepseek?.apiKey) {
      throw new Error("DeepSeek API key not configured");
    }
    this.apiKey = config.llm.deepseek.apiKey;
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

      const data = (await response.json()) as { data: DeepSeekModel[] };
      let models = data.data.map((model) => model.id);

      if (filter) {
        const filterLower = filter.toLowerCase();
        models = models.filter((id) => id.toLowerCase().includes(filterLower));
      }

      return models.sort();
    } catch (error) {
      throw new Error(
        `Failed to list DeepSeek models: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async generate(request: ChatCompletionRequest): Promise<GenerationResult> {
    const deepSeekRequest = this.buildRequest(request, false);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(deepSeekRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `DeepSeek API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        );
      }

      const data = (await response.json()) as DeepSeekResponse;

      if (!data.choices?.[0]) {
        throw new Error("No choices returned from DeepSeek API");
      }

      return {
        text: data.choices[0].message.content,
        metadata: {
          model: deepSeekRequest.model,
          provider: "deepseek",
        },
      };
    } catch (error) {
      throw new Error(
        `DeepSeek generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async *generateStream(
    request: ChatCompletionRequest
  ): AsyncIterable<GenerationResultDelta, GenerationResult> {
    const deepSeekRequest = this.buildRequest(request, true);
    let accumulatedText = "";

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(deepSeekRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `DeepSeek API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
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
                const json = JSON.parse(data) as DeepSeekStreamDelta;
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
          model: deepSeekRequest.model,
          provider: "deepseek",
        },
      };
    } catch (error) {
      throw new Error(
        `DeepSeek streaming failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  renderPrompt(request: ChatCompletionRequest): string {
    return JSON.stringify(this.buildRequest(request, false), null, 2);
  }

  private buildRequest(
    request: ChatCompletionRequest,
    stream: boolean
  ): DeepSeekRequest {
    const messages: DeepSeekMessage[] = request.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    const { parameters } = request;

    const deepSeekRequest: DeepSeekRequest = {
      model: request.model,
      messages,
      stream,
    };

    if (parameters.temperature !== undefined) {
      deepSeekRequest.temperature = parameters.temperature;
    }

    if (parameters.maxTokens !== undefined) {
      deepSeekRequest.max_tokens = parameters.maxTokens;
    }

    if (parameters.stopSequences && parameters.stopSequences.length > 0) {
      deepSeekRequest.stop = parameters.stopSequences;
    }

    return deepSeekRequest;
  }
}
