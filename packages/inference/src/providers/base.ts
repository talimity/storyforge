import type { TextInferenceCapabilities } from "../types";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stop?: string[];
  seed?: number;
  responseFormat?: "text" | { type: "json_schema"; schema: object } | "json";
  usePrefill?: boolean;
}

export interface ChatCompletionResponse {
  message: ChatMessage;
  metadata?: Record<string, unknown>;
}

export interface ChatCompletionChunk {
  delta?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelSearchResult {
  id: string;
  name?: string;
  description?: string;
  contextLength?: number;
  tags?: string[];
}

export interface ProviderAuth {
  apiKey?: string;
  orgId?: string;
  extraHeaders?: Record<string, string>;
}

export abstract class ProviderAdapter {
  abstract readonly kind: string;

  constructor(
    protected auth: ProviderAuth,
    protected baseUrl?: string
  ) {}

  abstract defaultCapabilities(): TextInferenceCapabilities;

  abstract supportedParams(): Array<keyof ChatCompletionRequest>;

  abstract complete(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse>;

  abstract completeStream(
    request: ChatCompletionRequest
  ): AsyncIterable<ChatCompletionChunk>;

  abstract renderPrompt(request: ChatCompletionRequest): string;

  async searchModels(_query?: string): Promise<ModelSearchResult[]> {
    // Default implementation returns empty array
    // Providers can override to implement actual search
    return [];
  }

  protected validateRequest(
    request: ChatCompletionRequest,
    capabilities: TextInferenceCapabilities
  ): void {
    // Check if prefill is requested but not supported
    if (request.usePrefill && !capabilities.assistantPrefill) {
      throw new Error("Assistant prefill is not supported by this provider");
    }

    // Additional validation can be added here
  }

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.auth.apiKey) {
      headers.Authorization = `Bearer ${this.auth.apiKey}`;
    }

    if (this.auth.extraHeaders) {
      Object.assign(headers, this.auth.extraHeaders);
    }

    return headers;
  }
}
