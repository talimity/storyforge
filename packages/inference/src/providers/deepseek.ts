import type { TextInferenceCapabilities } from "../types";
import {
  type ChatCompletionChunk,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  type ModelSearchResult,
  ProviderAdapter,
  type ProviderAuth,
} from "./base";

interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
  stream?: boolean;
}

interface DeepSeekResponse {
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

// Hardcoded list of DeepSeek models
const DEEPSEEK_MODELS: ModelSearchResult[] = [
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    description: "Advanced conversational AI model optimized for dialogue",
    contextLength: 128000,
    tags: ["chat", "general"],
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner",
    description: "Model optimized for complex reasoning and problem-solving",
    contextLength: 128000,
    tags: ["reasoning", "analysis"],
  },
  {
    id: "deepseek-coder",
    name: "DeepSeek Coder",
    description: "Specialized model for code generation and understanding",
    contextLength: 128000,
    tags: ["code", "programming"],
  },
];

export class DeepSeekAdapter extends ProviderAdapter {
  readonly kind = "deepseek";
  private readonly apiUrl = "https://api.deepseek.com/v1";

  constructor(auth: ProviderAuth) {
    super(auth, "https://api.deepseek.com/v1");
  }

  defaultCapabilities(): TextInferenceCapabilities {
    return {
      streaming: true,
      assistantPrefill: false,
      logprobs: false,
      tools: false,
      fim: false,
    };
  }

  supportedParams(): Array<keyof ChatCompletionRequest> {
    return [
      "messages",
      "model",
      "temperature",
      "topP",
      "maxTokens",
      "presencePenalty",
      "frequencyPenalty",
      "stop",
    ];
  }

  async complete(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    const capabilities = this.defaultCapabilities();
    this.validateRequest(request, capabilities);

    const deepSeekRequest = this.transformRequest(request, false);

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(deepSeekRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${error}`);
    }

    const data: DeepSeekResponse = await response.json();

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

    const deepSeekRequest = this.transformRequest(request, true);

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(deepSeekRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${error}`);
    }

    if (!response.body) {
      throw new Error("No response body from DeepSeek");
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
    // Return hardcoded list, optionally filtered by query
    if (!query) {
      return DEEPSEEK_MODELS;
    }

    const lowerQuery = query.toLowerCase();
    return DEEPSEEK_MODELS.filter(
      (m) =>
        m.id.toLowerCase().includes(lowerQuery) ||
        m.name?.toLowerCase().includes(lowerQuery) ||
        m.description?.toLowerCase().includes(lowerQuery) ||
        m.tags?.some((t) => t.toLowerCase().includes(lowerQuery))
    );
  }

  private transformRequest(
    request: ChatCompletionRequest,
    stream: boolean
  ): DeepSeekRequest {
    // DeepSeek doesn't support assistant prefill, so we need to handle it
    let messages = request.messages;
    if (request.usePrefill && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        // Convert assistant prefill to a user message with instruction
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
      stream,
    };
  }
}
