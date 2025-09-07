import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderAuth,
  TextInferenceCapabilities,
  TextInferenceGenParams,
} from "../types.js";
import { ProviderAdapter } from "./base.js";

interface OpenAICompatibleMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAICompatibleRequest {
  model: string;
  messages: OpenAICompatibleMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
  stream?: boolean;
}

// interface OpenAICompatibleResponse {
//   id: string;
//   object: string;
//   created: number;
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

export class OpenAICompatibleAdapter extends ProviderAdapter {
  readonly kind = "openai-compatible";
  private readonly capabilities: TextInferenceCapabilities;
  private readonly genParams: Array<keyof TextInferenceGenParams>;

  constructor(
    auth: ProviderAuth,
    baseUrl: string,
    capabilities?: Partial<TextInferenceCapabilities>,
    genParams?: Array<keyof TextInferenceGenParams>
  ) {
    super(auth, baseUrl);

    // Default capabilities that can be overridden
    this.capabilities = {
      streaming: true,
      assistantPrefill: "explicit",
      tools: false,
      fim: false,
      ...capabilities,
    };

    // Default generation parameters that can be overridden
    this.genParams = genParams || [
      "temperature",
      "topP",
      "topK",
      "presencePenalty",
      "frequencyPenalty",
      "topLogprobs",
    ];

    // TODO: openai-compatible needs a way to customize parameter mapping, since
    // each implementation may differ slightly especially for parameters that
    // are not in the OpenAI spec (e.g. topK).
  }

  defaultCapabilities(): TextInferenceCapabilities {
    return this.applyOverrides(this.capabilities);
  }

  supportedParams(): Array<keyof TextInferenceGenParams> {
    return this.genParams;
  }

  async complete(_request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    throw new Error("OpenAI-compatible completion not implemented yet");
  }

  async *completeStream(_request: ChatCompletionRequest) {
    // biome-ignore lint/suspicious/noExplicitAny: NYI
    yield [] as any;
    // biome-ignore lint/suspicious/noExplicitAny: NYI
    return {} as any;
  }

  renderPrompt(request: ChatCompletionRequest): string {
    const transformed = this.transformRequest(request, false);
    return JSON.stringify(transformed, null, 2);
  }

  override async searchModels(query?: string) {
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
      const models: { id: string }[] = data.data || [];

      let filtered = models;
      if (query) {
        const lowerQuery = query.toLowerCase();
        filtered = models.filter((m) => m.id.toLowerCase().includes(lowerQuery));
      }

      return filtered.map((m) => ({
        id: m.id,
        name: m.id,
        description: m.id,
        tags: [],
      }));
    } catch {
      // If fetching models fails, return empty array
      return [];
    }
  }

  private transformRequest(
    _request: ChatCompletionRequest,
    _stream: boolean
  ): OpenAICompatibleRequest {
    throw new Error("OpenAI-compatible request transformation not implemented yet");
  }
}
