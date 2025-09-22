import { safeJson } from "@storyforge/utils";
import { bubbleProviderError, InferenceProviderError } from "../errors.js";
import { mergeConsecutiveRoles } from "../transforms.js";
import type {
  ChatCompletionChunk,
  ChatCompletionFinishReason,
  ChatCompletionLogprob,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderAuth,
  ProviderModelSearchResult,
  TextInferenceCapabilities,
  TextInferenceGenParams,
} from "../types.js";
import { iterateSSE } from "../utils/sse.js";
import { ProviderAdapter } from "./base.js";

// OpenRouter-specific types based on their API documentation
interface OpenRouterTextContent {
  type: "text";
  text: string;
}

interface OpenRouterImageContent {
  type: "image_url";
  image_url: {
    url: string; // URL or base64 encoded image data
    detail?: string; // Optional, defaults to "auto"
  };
}

type OpenRouterContentPart = OpenRouterTextContent | OpenRouterImageContent;

interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenRouterContentPart[];
  name?: string;
  tool_call_id?: string; // For tool messages
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
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
  repetition_penalty?: number;
  stop?: string | string[];
  seed?: number;
  stream?: boolean;
  response_format?: { type: "json_object" };
  logprobs?: boolean;
  top_logprobs?: number;
  // Tool use (future support)
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: object;
    };
  }>;
  tool_choice?: "none" | "auto" | { type: "function"; function: { name: string } };
  // OpenRouter-specific parameters
  transforms?: string[];
  models?: string[];
  route?: "fallback";
  /** refers to the providers openrouter will route the request to */
  provider?: {
    allow_fallbacks?: boolean;
    only?: string[];
  };
  user?: string;
}

interface OpenRouterResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  system_fingerprint?: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string | null;
    native_finish_reason: string | null;
    logprobs?: {
      content: Array<{
        token: string;
        logprob: number;
        bytes: number[] | null;
        top_logprobs?: Array<{
          token: string;
          logprob: number;
          bytes: number[] | null;
        }>;
      }> | null;
    };
    error?: {
      code: number;
      message: string;
      metadata?: Record<string, unknown>;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  system_fingerprint?: string;
  choices: Array<{
    index: number;
    delta: {
      role?: "assistant";
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason?: string | null;
    native_finish_reason?: string | null;
    logprobs?: {
      content?: Array<{
        token: string;
        logprob: number;
        bytes: number[] | null;
        top_logprobs?: Array<{
          token: string;
          logprob: number;
          bytes: number[] | null;
        }>;
      }> | null;
    };
    error?: {
      code: number;
      message: string;
      metadata?: Record<string, unknown>;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterModelObject {
  id: string;
  name: string;
  created: number;
  description?: string;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string;
  };
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    request?: string;
  };
  context_length?: number;
  supported_parameters?: string[];
}

interface OpenRouterModelsResponse {
  data: OpenRouterModelObject[];
}

// https://openrouter.ai/docs/api-reference/overview

export class OpenRouterAdapter extends ProviderAdapter {
  readonly kind = "openrouter";
  private readonly apiUrl: string;

  constructor(auth: ProviderAuth, baseUrl = "https://openrouter.ai/api/v1") {
    super(auth, baseUrl);
    this.apiUrl = baseUrl;
  }

  defaultCapabilities(): TextInferenceCapabilities {
    return this.applyOverrides({
      streaming: true,
      assistantPrefill: "implicit", // OpenRouter handles this automatically
      tools: true,
      fim: false,
      textCompletions: false,
    });
  }

  supportedParams(): Array<keyof TextInferenceGenParams> {
    return ["temperature", "topP", "topK", "presencePenalty", "frequencyPenalty", "topLogprobs"];
  }

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const capabilities = this.defaultCapabilities();
    const { prefillMode } = this.preflightCheck(request, capabilities);

    const openRouterRequest = this.transformRequest(request, false, prefillMode);

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(openRouterRequest),
      signal: request.signal,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data: OpenRouterResponse = await response.json();
    const result = this.transformResponse(data);

    // Add debug metadata with the exact request sent
    result.metadata = { ...result.metadata, _prompt: openRouterRequest };

    return result;
  }

  async *completeStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<ChatCompletionChunk, ChatCompletionResponse> {
    const capabilities = this.defaultCapabilities();
    const { prefillMode } = this.preflightCheck(request, capabilities);

    const openRouterRequest = this.transformRequest(request, true, prefillMode);

    const headers = this.getHeaders();
    headers.Accept = "text/event-stream";

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(openRouterRequest),
      signal: request.signal,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    if (!response.body) {
      throw new InferenceProviderError("No response body from OpenRouter API");
    }

    let accumulatedContent = "";
    let role: "assistant" | undefined;
    let finishReason: ChatCompletionFinishReason = "stop";
    let nativeFinishReason: string | null = null;
    let usageData: OpenRouterStreamChunk["usage"] | undefined;
    const accumulatedLogprobs: ChatCompletionLogprob[] = [];

    try {
      for await (const evt of iterateSSE(response.body)) {
        if (!evt.data) continue;

        const chunk = safeJson<OpenRouterStreamChunk>(evt.data);
        if (!chunk) continue; // ignore malformed/keep-alive lines

        if (chunk.usage) usageData = chunk.usage;
        if (!chunk.choices?.[0]) continue;

        const choice = chunk.choices[0];

        if (choice.error) {
          throw new InferenceProviderError(`OpenRouter stream error: ${choice.error.message}`);
        }

        if (choice.delta?.role) {
          role = choice.delta.role;
          yield { delta: { role } };
        }

        if (choice.delta?.content) {
          accumulatedContent += choice.delta.content;
          yield { delta: { content: choice.delta.content } };
        }

        if (choice.logprobs?.content) {
          const logprobChunks = this.transformLogprobs(choice.logprobs.content);
          accumulatedLogprobs.push(...logprobChunks);
          yield { delta: { logprobs: logprobChunks } };
        }

        if (choice.finish_reason) {
          finishReason = this.mapFinishReason(choice.finish_reason);
          nativeFinishReason = choice.native_finish_reason || null;
        }
      }
    } catch (err) {
      console.log("Stream error", err);
      bubbleProviderError(err, "OpenRouter streaming error");
    }

    // Return the final accumulated response
    return {
      message: { role: role || "assistant", content: accumulatedContent },
      finishReason,
      metadata: {
        provider: "openrouter",
        model: request.model,
        nativeFinishReason,
        _prompt: openRouterRequest,
        ...(usageData && {
          usage: {
            promptTokens: usageData.prompt_tokens,
            completionTokens: usageData.completion_tokens,
            totalTokens: usageData.total_tokens,
          },
        }),
      },
      ...(accumulatedLogprobs.length > 0 && { logprobs: accumulatedLogprobs }),
    };
  }

  async renderPrompt(request: ChatCompletionRequest): Promise<string> {
    const capabilities = this.defaultCapabilities();
    const { prefillMode } = this.preflightCheck(request, capabilities);
    const transformed = this.transformRequest(request, false, prefillMode);
    return JSON.stringify(transformed, null, 2);
  }

  override async searchModels(query?: string): Promise<ProviderModelSearchResult[]> {
    try {
      const response = await fetch(`${this.apiUrl}/models/user`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.warn(
          `Failed to fetch models from OpenRouter API: ${response.status} ${response.statusText}`
        );
        return [];
      }

      const data: OpenRouterModelsResponse = await response.json();

      let models = data.data.map((model) => ({
        id: model.id,
        name: model.name || null,
        description: model.description || null,
      }));

      if (query) {
        const lowerQuery = query.toLowerCase();
        models = models.filter(
          (m) =>
            m.id.toLowerCase().includes(lowerQuery) ||
            m.name?.toLowerCase().includes(lowerQuery) ||
            m.description?.toLowerCase().includes(lowerQuery)
        );
      }

      return models;
    } catch (error) {
      console.warn("Failed to fetch models from OpenRouter API:", error);
      return [];
    }
  }

  private transformRequest(
    request: ChatCompletionRequest,
    stream: boolean,
    _prefillMode: "prefill" | "no-prefill"
  ): OpenRouterRequest {
    const { model, maxOutputTokens, genParams, stop } = request;

    // Transform messages to OpenRouter format
    // OpenRouter handles assistant prefill implicitly, so we don't need special handling
    const mergedMessages = mergeConsecutiveRoles(request.messages);
    const messages: OpenRouterMessage[] = mergedMessages.map(({ role, content }) => {
      // For now, we only support text content
      // TODO: Add support for image content when needed
      return { role, content };
    });

    const payload: OpenRouterRequest = {
      model,
      messages,
      stream,
    };

    // TODO: allow openrouter provider filtering on model profiles
    if (request.model.includes("moonshotai")) {
      payload.provider = {
        only: ["DeepInfra"],
        allow_fallbacks: false,
      };
    }
    if (request.model.includes("z-ai")) {
      payload.provider = {
        only: ["SiliconFlow"],
        allow_fallbacks: false,
      };
    }

    // Map generation parameters
    if (genParams) {
      const { temperature, topP, topK, presencePenalty, frequencyPenalty, topLogprobs } = genParams;

      if (temperature !== undefined) {
        payload.temperature = Math.max(0, Math.min(2, temperature));
      }

      if (topP !== undefined) {
        payload.top_p = Math.max(0, Math.min(1, topP));
      }

      if (topK !== undefined) {
        payload.top_k = Math.max(0, topK);
      }

      if (presencePenalty !== undefined) {
        payload.presence_penalty = Math.max(-2, Math.min(2, presencePenalty));
      }

      if (frequencyPenalty !== undefined) {
        payload.frequency_penalty = Math.max(-2, Math.min(2, frequencyPenalty));
      }

      if (topLogprobs !== undefined) {
        payload.logprobs = true;
        payload.top_logprobs = Math.min(20, Math.max(0, Number(topLogprobs)));
      }
    }

    // Set max tokens
    if (maxOutputTokens !== undefined) {
      payload.max_tokens = maxOutputTokens;
    }

    // Set stop sequences
    if (Array.isArray(stop) && stop.length > 0) {
      payload.stop = stop;
    }

    return payload;
  }

  private transformResponse(response: OpenRouterResponse): ChatCompletionResponse {
    const choice = response.choices[0];

    if (!choice) {
      throw new InferenceProviderError("No choices in OpenRouter response");
    }

    // Handle choice-level errors
    if (choice.error) {
      throw new InferenceProviderError(`OpenRouter error: ${choice.error.message}`);
    }

    const result: ChatCompletionResponse = {
      message: {
        role: "assistant",
        content: choice.message.content || "",
      },
      finishReason: this.mapFinishReason(choice.finish_reason),
      metadata: {
        provider: "openrouter",
        model: response.model,
        id: response.id,
        created: response.created,
        nativeFinishReason: choice.native_finish_reason,
      },
    };

    // Transform logprobs if present
    if (choice.logprobs?.content) {
      result.logprobs = this.transformLogprobs(choice.logprobs.content);
    }

    // Include usage statistics if present
    if (response.usage && result.metadata) {
      result.metadata.usage = {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      };
    }

    return result;
  }

  private transformLogprobs(
    logprobs: Array<{
      token: string;
      logprob: number;
      bytes: number[] | null;
      top_logprobs?: Array<{
        token: string;
        logprob: number;
        bytes: number[] | null;
      }>;
    }>
  ): ChatCompletionLogprob[] {
    return logprobs.map((lp) => ({
      token: lp.token,
      logprob: lp.logprob,
      bytes: lp.bytes || undefined,
      topLogprobs: lp.top_logprobs?.map((tlp) => ({
        token: tlp.token,
        logprob: tlp.logprob,
        bytes: tlp.bytes || [],
      })),
    }));
  }

  private async handleErrorResponse(response: Response) {
    const errorText = await response.text();
    const statusCode = response.status;
    let errorMessage = errorText || response.statusText;

    // Try to extract more specific error message from JSON response
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      } else if (errorData.error?.code) {
        errorMessage = `${errorData.error.code}: ${errorMessage}`;
      }
    } catch {
      // Use raw text if not JSON
    }

    console.log("OpenRouter error", errorText);

    // Map status codes to specific error types
    if (statusCode === 401 || statusCode === 403) {
      throw new InferenceProviderError(`Authentication error: ${errorMessage}`);
    }
    if (statusCode === 429) {
      throw new InferenceProviderError(`Rate limit exceeded: ${errorMessage}`);
    }
    if (statusCode === 413 || errorMessage.toLowerCase().includes("context")) {
      throw new InferenceProviderError(`Context too large: ${errorMessage}`);
    }
    if (statusCode === 400) {
      throw new InferenceProviderError(`Invalid request: ${errorMessage}`);
    }

    // Generic upstream error
    throw new InferenceProviderError(`OpenRouter API error (${statusCode}): ${errorMessage}`);
  }

  private mapFinishReason(reason: string | null): ChatCompletionFinishReason {
    // OpenRouter normalizes finish_reason to these values
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "content_filter":
        return "content_filter";
      case "tool_calls":
        return "tool_use";
      case "error":
        return "other";
      default:
        return "other";
    }
  }
}
