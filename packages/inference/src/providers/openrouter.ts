import type { TextInferenceCapabilities } from "../types";
import {
  type ChatCompletionChunk,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  type ModelSearchResult,
  ProviderAdapter,
  type ProviderAuth,
} from "./base";

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
  seed?: number;
  stream?: boolean;
}

interface OpenRouterResponse {
  id: string;
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

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  top_provider?: {
    context_length: number;
    max_completion_tokens: number;
  };
}

export class OpenRouterAdapter extends ProviderAdapter {
  readonly kind = "openrouter";
  private readonly apiUrl = "https://openrouter.ai/api/v1";

  constructor(auth: ProviderAuth) {
    super(auth, "https://openrouter.ai/api/v1");
  }

  defaultCapabilities(): TextInferenceCapabilities {
    return {
      streaming: true,
      assistantPrefill: true,
      logprobs: true,
      tools: true,
      fim: false,
    };
  }

  supportedParams(): Array<keyof ChatCompletionRequest> {
    return [
      "messages",
      "model",
      "temperature",
      "topP",
      "topK",
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
    const capabilities = this.defaultCapabilities();
    this.validateRequest(request, capabilities);

    const openRouterRequest = this.transformRequest(request, false);

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(openRouterRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data: OpenRouterResponse = await response.json();

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
    const capabilities = this.defaultCapabilities();
    this.validateRequest(request, capabilities);

    const openRouterRequest = this.transformRequest(request, true);

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(openRouterRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    if (!response.body) {
      throw new Error("No response body from OpenRouter");
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
    const response = await fetch(`${this.apiUrl}/models`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      console.error("Failed to fetch OpenRouter models");
      return [];
    }

    const data = await response.json();
    const models: OpenRouterModel[] = data.data || [];

    let filtered = models;
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = models.filter(
        (m) =>
          m.id.toLowerCase().includes(lowerQuery) ||
          m.name?.toLowerCase().includes(lowerQuery) ||
          m.description?.toLowerCase().includes(lowerQuery)
      );
    }

    return filtered.map((m) => ({
      id: m.id,
      name: m.name || m.id,
      description: m.description,
      contextLength: m.context_length || m.top_provider?.context_length,
      tags: [],
    }));
  }

  private transformRequest(
    request: ChatCompletionRequest,
    stream: boolean
  ): OpenRouterRequest {
    // Handle assistant prefill if needed
    const messages = request.messages;
    if (request.usePrefill && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        // OpenRouter supports assistant messages naturally
        // No transformation needed
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
      top_k: request.topK,
      max_tokens: request.maxTokens,
      presence_penalty: request.presencePenalty,
      frequency_penalty: request.frequencyPenalty,
      stop: request.stop,
      seed: request.seed,
      stream,
    };
  }
}
