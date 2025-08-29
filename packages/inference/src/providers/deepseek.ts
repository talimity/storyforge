import { InferenceProviderError } from "../errors";
import { mergeConsecutiveRoles } from "../transforms";
import type {
  ChatCompletionChunk,
  ChatCompletionFinishReason,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderAuth,
  ProviderModelSearchResult,
  TextInferenceCapabilities,
  TextInferenceGenParams,
} from "../types";
import { ProviderAdapter } from "./base";

// Deepseek-specific types based on the OpenAPI spec
interface DeepseekMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  prefix?: boolean; // For assistant messages: force model to start with this content
  reasoning_content?: string | null; // For deepseek-reasoner model
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

interface DeepseekRequest {
  model: string;
  messages: DeepseekMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  stream_options?: {
    include_usage?: boolean;
  };
  logprobs?: boolean;
  top_logprobs?: number;
  response_format?: {
    type: "text" | "json_object";
  };
  seed?: number;
  // Tool use (not implemented yet)
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: object;
      strict?: boolean;
    };
  }>;
  tool_choice?:
    | "none"
    | "auto"
    | "required"
    | { type: "function"; function: { name: string } };
}

interface DeepseekResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  system_fingerprint: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason:
      | "stop"
      | "length"
      | "content_filter"
      | "tool_calls"
      | "insufficient_system_resource";
    logprobs?: {
      content: Array<{
        token: string;
        logprob: number;
        bytes: number[] | null;
        top_logprobs: Array<{
          token: string;
          logprob: number;
          bytes: number[] | null;
        }>;
      }> | null;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
}

interface DeepseekStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  system_fingerprint: string;
  choices: Array<{
    index: number;
    delta: {
      role?: "assistant";
      content?: string | null;
      reasoning_content?: string | null;
    };
    finish_reason?:
      | "stop"
      | "length"
      | "content_filter"
      | "tool_calls"
      | "insufficient_system_resource"
      | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface DeepseekModelObject {
  id: string;
  object: "model";
  owned_by: string;
}

interface DeepseekModelsResponse {
  object: "list";
  data: DeepseekModelObject[];
}

export class DeepseekAdapter extends ProviderAdapter {
  readonly kind = "deepseek";
  private readonly apiUrl: string;

  constructor(auth: ProviderAuth, baseUrl = "https://api.deepseek.com") {
    super(auth, baseUrl);
    this.apiUrl = baseUrl;
  }

  defaultCapabilities(): TextInferenceCapabilities {
    return {
      streaming: true,
      assistantPrefill: "explicit", // Uses the 'prefix' flag
      tools: true,
      fim: false,
    };
  }

  supportedParams(): Array<keyof TextInferenceGenParams> {
    return [
      "temperature",
      "topP",
      "presencePenalty",
      "frequencyPenalty",
      "topLogprobs",
    ];
  }

  async complete(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    const capabilities = this.defaultCapabilities();
    const { prefillMode } = this.preflight(request, capabilities);

    const deepseekRequest = this.transformRequest(request, false, prefillMode);

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(deepseekRequest),
      signal: request.signal,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data: DeepseekResponse = await response.json();
    const result = this.transformResponse(data);

    // Add debug metadata with the exact request sent
    result.metadata = { ...result.metadata, _prompt: deepseekRequest };

    return result;
  }

  async *completeStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<ChatCompletionChunk, ChatCompletionResponse> {
    const capabilities = this.defaultCapabilities();
    const { prefillMode } = this.preflight(request, capabilities);

    const deepseekRequest = this.transformRequest(request, true, prefillMode);

    // Add streaming-specific headers
    const headers = this.getHeaders();
    headers.Accept = "text/event-stream";

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(deepseekRequest),
      signal: request.signal,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    if (!response.body) {
      throw new InferenceProviderError("No response body from Deepseek API");
    }

    let accumulatedContent = "";
    let accumulatedReasoningContent = "";
    let role: "assistant" | undefined;
    let finishReason: ChatCompletionFinishReason = "stop";
    let usageData: DeepseekStreamChunk["usage"] | undefined;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventBuffer: string[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          // Accumulate data lines for the current event
          if (line.startsWith("data: ")) {
            eventBuffer.push(line.slice(6).trimStart());
          } else if (line.trim() === "") {
            // Empty line marks the end of an SSE event
            if (eventBuffer.length > 0) {
              const dataStr = eventBuffer.join("\n");
              eventBuffer = [];

              if (dataStr === "[DONE]") {
                continue;
              }

              try {
                const chunk: DeepseekStreamChunk = JSON.parse(dataStr);

                if (chunk.choices?.[0]) {
                  const choice = chunk.choices[0];

                  // Yield role if present
                  if (choice.delta?.role) {
                    role = choice.delta.role;
                    yield { delta: { role } };
                  }

                  // Yield content if present
                  if (choice.delta?.content) {
                    accumulatedContent += choice.delta.content;
                    yield { delta: { content: choice.delta.content } };
                  }

                  // Accumulate reasoning content if present (for deepseek-reasoner)
                  if (choice.delta?.reasoning_content) {
                    accumulatedReasoningContent +=
                      choice.delta.reasoning_content;
                    yield {
                      delta: {
                        reasoningContent: choice.delta.reasoning_content,
                      },
                    };
                  }

                  // Update finish reason if present
                  if (choice.finish_reason) {
                    finishReason = this.mapFinishReason(choice.finish_reason);
                  }
                }

                // Capture usage data if present (typically in the final chunk)
                if (chunk.usage) {
                  usageData = chunk.usage;
                }
              } catch (error) {
                console.error("Failed to parse SSE event:", error);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Return the final accumulated response
    const finalResponse: ChatCompletionResponse = {
      message: {
        role: role || "assistant",
        content: accumulatedContent,
      },
      finishReason,
      metadata: {
        provider: "deepseek",
        model: request.model,
        _prompt: deepseekRequest,
      },
    };

    if (accumulatedReasoningContent) {
      finalResponse.reasoningContent = accumulatedReasoningContent;
    }

    // Add usage statistics if available from streaming
    if (usageData && finalResponse.metadata) {
      finalResponse.metadata.usage = {
        promptTokens: usageData.prompt_tokens,
        completionTokens: usageData.completion_tokens,
        totalTokens: usageData.total_tokens,
      };
    }

    return finalResponse;
  }

  renderPrompt(request: ChatCompletionRequest): string {
    const capabilities = this.defaultCapabilities();
    const { prefillMode } = this.preflight(request, capabilities);
    const transformed = this.transformRequest(request, false, prefillMode);
    return JSON.stringify(transformed, null, 2);
  }

  override async searchModels(
    query?: string
  ): Promise<ProviderModelSearchResult[]> {
    try {
      const response = await fetch(`${this.apiUrl}/models`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.warn(
          `Failed to fetch models from Deepseek API: ${response.status} ${response.statusText}`
        );
        return [];
      }

      const data: DeepseekModelsResponse = await response.json();

      let models = data.data.map((model) => ({ id: model.id }));

      if (query) {
        const lowerQuery = query.toLowerCase();
        models = models.filter((m) => m.id.toLowerCase().includes(lowerQuery));
      }

      return models;
    } catch (error) {
      console.warn("Failed to fetch models from Deepseek API:", error);
      return [];
    }
  }

  private transformRequest(
    request: ChatCompletionRequest,
    stream: boolean,
    prefillMode: "prefill" | "no-prefill"
  ): DeepseekRequest {
    const { model, maxTokens, genParams, stop } = request;

    // Transform messages to Deepseek format
    const mergedMessages = mergeConsecutiveRoles(request.messages);
    const messages: DeepseekMessage[] = mergedMessages.map(
      ({ role, content }, index) => {
        const deepseekMsg: DeepseekMessage = { role, content };

        // Handle explicit assistant prefill using the 'prefix' flag
        if (
          role === "assistant" &&
          index === mergedMessages.length - 1 &&
          prefillMode === "prefill"
        ) {
          deepseekMsg.prefix = true;
        }

        return deepseekMsg;
      }
    );

    const payload: DeepseekRequest = { model, messages, stream };

    // Map generation parameters
    if (genParams) {
      const {
        temperature,
        topP,
        presencePenalty,
        frequencyPenalty,
        topLogprobs,
      } = genParams;

      if (temperature !== undefined) {
        payload.temperature = Math.max(0, Math.min(2, temperature));
      }

      if (topP !== undefined) {
        payload.top_p = Math.max(0, Math.min(1, topP));
      }

      if (presencePenalty !== undefined) {
        payload.presence_penalty = Math.max(-2, Math.min(2, presencePenalty));
      }

      if (frequencyPenalty !== undefined) {
        payload.frequency_penalty = Math.max(-2, Math.min(2, frequencyPenalty));
      }

      const wantsLogprobs = topLogprobs !== undefined && !stream;
      if (wantsLogprobs) {
        payload.logprobs = true;
        payload.top_logprobs = Math.min(20, Number(topLogprobs));
      }
    }

    // Set max tokens
    if (maxTokens !== undefined) {
      payload.max_tokens = Math.min(8192, maxTokens);
    }

    // Set stop sequences (Deepseek supports up to 16)
    if (Array.isArray(stop) && stop.length > 0) {
      payload.stop = stop.slice(0, 16);
    }

    // Request usage stats in streaming mode
    if (stream) {
      payload.stream_options = { include_usage: true };
    }

    return payload;
  }

  private transformResponse(
    response: DeepseekResponse
  ): ChatCompletionResponse {
    const choice = response.choices[0];

    if (!choice) {
      throw new InferenceProviderError("No choices in Deepseek response");
    }

    const result: ChatCompletionResponse = {
      message: {
        role: "assistant",
        content: choice.message.content || "",
      },
      finishReason: this.mapFinishReason(choice.finish_reason),
      metadata: {
        provider: "deepseek",
        model: response.model,
        id: response.id,
        created: response.created,
      },
    };

    // Include reasoning content if present (for deepseek-reasoner)
    if (choice.message.reasoning_content) {
      result.reasoningContent = choice.message.reasoning_content;
    }

    // Transform logprobs if present
    if (choice.logprobs?.content) {
      result.logprobs = choice.logprobs.content.map((lp) => ({
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

    // Include usage statistics if present
    if (response.usage && result.metadata) {
      result.metadata.usage = {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        promptCacheHitTokens: response.usage.prompt_cache_hit_tokens,
        promptCacheMissTokens: response.usage.prompt_cache_miss_tokens,
        reasoningTokens:
          response.usage.completion_tokens_details?.reasoning_tokens,
      };
    }

    return result;
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
      }
    } catch {
      // Use raw text if not JSON
    }

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

    // Generic upstream error
    throw new InferenceProviderError(
      `Deepseek API error (${statusCode}): ${errorMessage}`
    );
  }

  private mapFinishReason(
    reason:
      | "stop"
      | "length"
      | "content_filter"
      | "tool_calls"
      | "insufficient_system_resource"
  ): ChatCompletionFinishReason {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "content_filter":
        return "content_filter";
      case "tool_calls":
        return "tool_use";
      case "insufficient_system_resource":
        return "other";
      default:
        return "other";
    }
  }
}
