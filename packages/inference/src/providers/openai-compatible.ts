import type { TextInferenceCapabilities } from "../types";
import {
  type ChatCompletionChunk,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  type ModelSearchResult,
  ProviderAdapter,
  type ProviderAuth,
} from "./base";

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
  seed?: number;
  stream?: boolean;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export class OpenAICompatibleAdapter extends ProviderAdapter {
  readonly kind = "openai-compatible";
  private capabilities: TextInferenceCapabilities;

  constructor(
    auth: ProviderAuth,
    baseUrl: string,
    capabilities?: Partial<TextInferenceCapabilities>
  ) {
    super(auth, baseUrl);

    // Default capabilities that can be overridden
    this.capabilities = {
      streaming: true,
      assistantPrefill: false,
      logprobs: false,
      tools: false,
      fim: false,
      ...capabilities,
    };
  }

  defaultCapabilities(): TextInferenceCapabilities {
    return this.capabilities;
  }

  supportedParams(): Array<keyof ChatCompletionRequest> {
    // Most OpenAI-compatible APIs support these parameters
    return [
      "messages",
      "model",
      "temperature",
      "topP",
      "maxTokens",
      "presencePenalty",
      "frequencyPenalty",
      "stop",
      "seed",
    ];
  }

  async complete(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    this.validateRequest(request, this.capabilities);

    if (!this.baseUrl) {
      throw new Error("Base URL is required for OpenAI-compatible provider");
    }

    const openAIRequest = this.transformRequest(request, false);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(openAIRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI-compatible API error: ${error}`);
    }

    const data: OpenAIResponse = await response.json();

    return {
      message: {
        role: "assistant",
        content: data.choices[0]?.message.content || "",
      },
      metadata: {
        model: data.model,
        usage: data.usage,
      },
    };
  }

  async *completeStream(
    request: ChatCompletionRequest
  ): AsyncIterable<ChatCompletionChunk> {
    this.validateRequest(request, this.capabilities);

    if (!this.baseUrl) {
      throw new Error("Base URL is required for OpenAI-compatible provider");
    }

    const openAIRequest = this.transformRequest(request, true);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(openAIRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI-compatible API error: ${error}`);
    }

    if (!response.body) {
      throw new Error("No response body from OpenAI-compatible API");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              return;
            }

            try {
              const chunk = JSON.parse(data);
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) {
                yield { delta };
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  renderPrompt(request: ChatCompletionRequest): string {
    const transformed = this.transformRequest(request, false);
    return JSON.stringify(transformed, null, 2);
  }

  override async searchModels(query?: string): Promise<ModelSearchResult[]> {
    if (!this.baseUrl) {
      return [];
    }

    try {
      // Try to fetch models from the /models endpoint
      // Not all OpenAI-compatible APIs support this
      const response = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        // If models endpoint is not available, return empty array
        return [];
      }

      const data = await response.json();
      const models: OpenAIModel[] = data.data || [];

      let filtered = models;
      if (query) {
        const lowerQuery = query.toLowerCase();
        filtered = models.filter((m) =>
          m.id.toLowerCase().includes(lowerQuery)
        );
      }

      return filtered.map((m) => ({
        id: m.id,
        name: m.id,
        description: `Owned by ${m.owned_by}`,
        tags: [],
      }));
    } catch {
      // If fetching models fails, return empty array
      return [];
    }
  }

  private transformRequest(
    request: ChatCompletionRequest,
    stream: boolean
  ): OpenAIRequest {
    // Handle assistant prefill if supported
    let messages = request.messages;
    if (request.usePrefill && this.capabilities.assistantPrefill) {
      // Some OpenAI-compatible APIs might support assistant messages
      // This would need to be configured per provider
    } else if (request.usePrefill && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        // Convert to user message if prefill not supported
        messages = [
          ...messages.slice(0, -1),
          {
            role: "user",
            content: `Continue from: "${lastMessage.content}"`,
          },
        ];
      }
    }

    return {
      model: request.model,
      messages: messages.map((m) => ({
        role: m.role === "tool" ? "assistant" : m.role,
        content: m.content,
      })),
      temperature: request.temperature,
      top_p: request.topP,
      max_tokens: request.maxTokens,
      presence_penalty: request.presencePenalty,
      frequency_penalty: request.frequencyPenalty,
      stop: request.stop,
      seed: request.seed,
      stream,
    };
  }
}
