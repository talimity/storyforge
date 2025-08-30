import { InferenceProviderCompatibilityError } from "@/errors";
import { preflightPrefill } from "@/preflights";
import type {
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderAuth,
  ProviderModelSearchResult,
  TextInferenceCapabilities,
  TextInferenceGenParams,
} from "@/types";

export abstract class ProviderAdapter {
  abstract readonly kind: string;

  protected constructor(
    protected auth: ProviderAuth,
    protected baseUrl?: string
  ) {}

  abstract defaultCapabilities(): TextInferenceCapabilities;

  abstract supportedParams(): Array<keyof TextInferenceGenParams>;

  /**
   * Given a chat completion request, invoke the provider's API to get a
   * completion response.
   */
  abstract complete(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse>;

  /**
   * Given a chat completion request, invoke the provider's API to get a
   * streaming completion response.
   */
  abstract completeStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<ChatCompletionChunk, ChatCompletionResponse>;

  abstract renderPrompt(request: ChatCompletionRequest): string;

  async searchModels(_query?: string): Promise<ProviderModelSearchResult[]> {
    return [];
  }

  /**
   * Run preflight checks on the request against the provider's capabilities.
   * Returns relevant metadata for request transformation.
   */
  protected preflight(
    request: ChatCompletionRequest,
    capabilities: TextInferenceCapabilities
  ) {
    const prefill = preflightPrefill(request, capabilities);
    // TODO: add more validation based on capabilities
    // ...

    if (!prefill.ok) {
      throw new InferenceProviderCompatibilityError(
        `Request validation failed: ${prefill.reason}`
      );
    }

    return { prefillMode: prefill.prefillMode };
  }

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // TODO: some providers do not use Bearer authentication (e.g. Anthropic
    // uses "x-api-key" header instead) so this needs to be provider-specific
    if (this.auth.apiKey) {
      headers.Authorization = `Bearer ${this.auth.apiKey}`;
    }

    if (this.auth.extraHeaders) {
      Object.assign(headers, this.auth.extraHeaders);
    }

    return headers;
  }
}
