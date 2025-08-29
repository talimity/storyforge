import type {
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderAuth,
  ProviderModelSearchResult,
  TextInferenceCapabilities,
  TextInferenceGenParams,
} from "../types";
import { ProviderAdapter } from "./base";

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

// interface OpenRouterResponse {
//   id: string;
//   model: string;
//   choices: Array<{
//     index: number;
//     message: {
//       role: string;
//       content: string;
//     };
//     finish_reason: string;
//   }>;
//   usage?: {
//     prompt_tokens: number;
//     completion_tokens: number;
//     total_tokens: number;
//   };
// }

// https://openrouter.ai/docs/api-reference/overview

export class OpenRouterAdapter extends ProviderAdapter {
  readonly kind = "openrouter";

  constructor(auth: ProviderAuth, baseUrl = "https://openrouter.ai/api/v1") {
    super(auth, baseUrl);
  }

  defaultCapabilities(): TextInferenceCapabilities {
    return {
      streaming: true,
      assistantPrefill: "implicit",
      tools: true,
      fim: false,
    };
  }

  supportedParams(): Array<keyof TextInferenceGenParams> {
    return [
      "temperature",
      "topP",
      "topK",
      "presencePenalty",
      "frequencyPenalty",
      "topLogprobs",
    ];
  }

  async complete(
    _request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    throw new Error("OpenRouter completion not implemented yet");
  }

  async *completeStream(
    _request: ChatCompletionRequest
  ): AsyncGenerator<ChatCompletionChunk, ChatCompletionResponse> {
    // biome-ignore lint/suspicious/noExplicitAny: NYI
    yield [] as any;
    // biome-ignore lint/suspicious/noExplicitAny: NYI
    return {} as any;
  }

  renderPrompt(request: ChatCompletionRequest): string {
    const transformed = this.transformRequest(request, false);
    return JSON.stringify(transformed, null, 2);
  }

  override async searchModels(
    _query?: string
  ): Promise<ProviderModelSearchResult[]> {
    throw new Error("OpenRouter model search not implemented yet");
  }

  private transformRequest(
    _request: ChatCompletionRequest,
    _stream: boolean
  ): OpenRouterRequest {
    throw new Error("OpenRouter request transformation not implemented yet");
  }
}
