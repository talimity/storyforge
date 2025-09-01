// Inference provider types and interfaces

export type ProviderKind =
  | "openrouter"
  | "deepseek"
  | "openai-compatible"
  | "mock";

export interface ProviderAuth {
  apiKey?: string;
  orgId?: string;
  extraHeaders?: Record<string, string>;
}

export interface ProviderModelSearchResult {
  id: string;
  name?: string;
  description?: string;
  // costs?
}

export interface ProviderConfig {
  kind: ProviderKind;
  auth: ProviderAuth;
  baseUrl?: string;
  capabilities?: Partial<TextInferenceCapabilities>;
  genParams?: Array<keyof TextInferenceGenParams>;
}

// Provider-agnostic request metadata and capabilities

/**
 * Represents the text generation capabilities of an inference provider.
 * Requests can be validated against these capabilities before being sent to the
 * provider.
 *
 * If a request needs some feature for correct operation, or if there is a high
 * likelihood of a poor model response without it, that feature should be
 * expressed as a capability.
 */
export type TextInferenceCapabilities = {
  /** Whether tokens can be streamed as they are generated. */
  streaming: boolean;
  /**
   * How the provider handles prefilling the assistant message.
   * - `implicit`: Provider automatically prefills the assistant message if the
   * last message is from the assistant (e.g., Anthropic, OpenRouter).
   * - `explicit`: Provider requires a specific flag to prefill the assistant
   * message (e.g., Mistral, DeepSeek).
   * - `unsupported`: Provider does not support prefilling the assistant message
   * and will always insert a turn break (e.g., OpenAI).
   */
  assistantPrefill: "implicit" | "explicit" | "unsupported";
  /** Whether tool use is supported. */
  tools: boolean;
  /** Whether filling in the middle of text is supported. */
  fim: boolean;

  // TODO: guided generation, `n` for parallel generations, etc.
};

/**
 * Represents generation/sampling parameters for a chat completion request.
 * Compared to capabilities, these parameters should not be critical for the
 * correct operation of a request and consumers should degrade gracefully if
 * they are not supported by a provider.
 *
 * Adapters should make a best effort to adapt the parameters in a way that the
 * provider allows. Unsupported parameters should be dropped, and omitted
 * parameters should be treated as requesting the provider's default behavior.
 * Incompatible ranges should be clamped to the provider's supported range.
 *
 * Errors related to unsupported or incompatible generation parameters should
 * generally not be thrown by the adapter itself.
 */
export interface TextInferenceGenParams {
  /**
   * The temperature sampling parameter.
   *
   * If `undefined`, the adapter should ideally send no temperature parameter at
   * all. If the provider throws an error when no temperature is provided, the
   * adapter should select a reasonable default of 0.7 or 1.0, depending on the
   * provider's recommendations.
   */
  temperature?: number;
  /**
   * The top-p/nucleus sampling parameter.
   *
   * If `undefined`, the adapter should ideally send no top-p parameter at all.
   * If the provider throws an error when no top-p is provided, the adapter
   * should default to 1.0 to disable nucleus sampling.
   */
  topP?: number;
  /**
   * The top-k sampling parameter.
   *
   * If `undefined`, the adapter should ideally send no top-k parameter at all.
   * If the provider throws an error when no top-k is provided, the adapter
   * should select a reasonable default of around 40.
   */
  topK?: number;
  /**
   * The presence penalty parameter.
   *
   * If `undefined`, the adapter should ideally send no presence penalty
   * parameter at all. If the provider throws an error when no presence penalty
   * is provided, the adapter should default to 0.0 to disable the penalty.
   */
  presencePenalty?: number;
  /**
   * The frequency penalty parameter.
   *
   * If `undefined`, the adapter should ideally send no frequency penalty
   * parameter at all. If the provider throws an error when no frequency penalty
   * is provided, the adapter should default to 0.0 to disable the penalty.
   */
  frequencyPenalty?: number;
  /**
   * If present, the number of top log probabilities to return for each token in
   * the response. If not present, no log probabilities should be requested,
   * which is typically the default behavior.
   *
   * The adapter should ensure that this value is clamped to the provider's
   * maximum supported value, if applicable.
   *
   * Logprob support is generally flaky even in providers that claim to support
   * it, so adapters should gracefully handle cases where logprobs are missing,
   * empty, or malformed.
   */
  topLogprobs?: number;
}

/**
 * Represents a set of hints that can be provided alongside a chat completion
 * request to indicate how the adapter should handle certain aspects of the
 * request, or whether it should be rejected based on capabilities.
 */
export type ChatCompletionRequestHints = {
  /**
   * 'auto'   => if the last message is assistant, assume we want prefill
   * 'require'=> prefill is semantically required (reject providers that can’t)
   * 'forbid' => do not prefill (reject providers that always prefill)
   */
  assistantPrefill?: "auto" | "require" | "forbid";
};

/**
 * Represents the result of a preflight check to determine whether a chat
 * completion request can be fulfilled given the provider's capabilities and
 * the request's hints.
 */
export type PreflightResult =
  | { ok: true; prefillMode: "prefill" | "no-prefill" }
  | { ok: false; reason: string };

// Provider-agnostic chat completion types

/**
 * Represents a single message in a chat completion request or response.
 */
export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

/**
 * Represents a chat completion request that can be sent to an inference
 * provider.
 *
 * This interface is designed to be provider-agnostic, allowing different
 * providers to implement their own adapters while adhering to a common
 * structure.
 */
export interface ChatCompletionRequest {
  /**
   * The message history for the chat completion request.
   *
   * There are no guarantees made about the order of messages, the number of
   * messages per role, whether the last message is from the user or assistant,
   * whether roles always alternate, etc.
   *
   * It is up to each adapter to apply any necessary post-processing to the
   * messages before sending them to the provider.
   */
  messages: ChatCompletionMessage[];
  /**
   * The provider-specific model ID requested for the chat completion.
   */
  model: string;
  /**
   * The maximum number of tokens to generate in the response. May be ignored or
   * clamped by the provider.
   *
   * The adapter is responsible for clamping this value to the provider's
   * maximum token limit, if applicable.
   */
  maxOutputTokens: number;
  /**
   * A list of stop sequences that will cause the model to stop generating
   * tokens.
   *
   * The adapter is responsible for ensuring that the list is trimmed to the
   * provider's maximum supported length, if applicable.
   */
  stop: string[];
  /**
   * Generation/sampling parameters for the chat completion request.
   */
  genParams?: TextInferenceGenParams;
  /**
   * Hints to guide the adapter in how to handle certain aspects of the
   * request, or whether it should be rejected based on capabilities.
   */
  hints?: ChatCompletionRequestHints;
  /**
   * An optional AbortSignal that can be used to cancel the request.
   * Adapters should pass this signal to their fetch calls to enable
   * request cancellation from the workflow runner.
   */
  signal?: AbortSignal;

  // TODO: strucutred output, tool use
}

/**
 * Represents the reason why a chat completion response finished.
 * - "stop": The model stopped because it reached a stop sequence.
 * - "length": The model stopped because it reached the max output length.
 * - "tool_use": The model stopped because it invoked a tool.
 * - "content_filter": The model stopped because it triggered a content filter.
 * - "other": The model stopped for some other reason.
 */
export type ChatCompletionFinishReason =
  | "stop"
  | "length"
  | "tool_use"
  | "content_filter"
  | "other";

/**
 * Represents a log probability of a single token in a chat completion response,
 * and optionally the top log probabilities for that position.
 */
export interface ChatCompletionLogprob {
  /**
   * String representation of the token ultimately selected by the model.
   *
   * In some cases, this may be a special token like "<|endoftext|>".
   */
  token: string;
  /**
   * Log probability of the selected token.
   *
   * Defaults to -999 if no log probability was provided by the model for this
   * token. Clamped to -999.
   */
  logprob: number;
  /**
   * List of UTF-8 bytes that make up the token. This is useful for characters
   * that may be split across multiple tokens, such as emojis or many CJK
   * characters, in which case the `token` field may not be sufficient to
   * reconstruct the original text.
   *
   * May be `undefined` if the provider does not support returning byte-level
   * information for tokens.
   */
  bytes?: number[];
  /**
   * List of the most likely tokens that the model considered at this position,
   * along with their log probabilities.
   *
   * Most providers allow requesting a fixed number of top logprobs, but this
   * array could contain fewer elements in some cases.
   */
  topLogprobs?: {
    token: string;
    logprob: number;
    bytes: number[];
  }[];
}

/**
 * Represents the fully generated response from a chat completion request.
 */
export interface ChatCompletionResponse {
  // TODO: tools, logprobs, token usage, etc.
  /** The message generated by the model. */
  message: ChatCompletionMessage;
  /** The model's internal reasoning, if available. */
  reasoningContent?: string;
  /**
   * The reason why this chat completion response ended.
   *
   * Implementations should map provider-specific reasons to these values as
   * best as possible, and include the raw reason in `metadata` if needed.
   */
  finishReason: ChatCompletionFinishReason;
  /**
   * List of log probabilities for each token in the response.
   */
  logprobs?: ChatCompletionLogprob[];
  /**
   * Metadata about the response, such as provider-specific information.
   * This can include raw provider response, model version, or any other
   * relevant information that doesn't fit into the standard response structure.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a chunk of a chat completion response emitted during a streaming
 * chat completion request.
 */
export interface ChatCompletionChunk {
  /**
   * New content generated since the last chunk.
   *
   * Note that this cannot be assumed to be a single token, as it is completely
   * arbitrary how providers chunk the output.
   */
  delta?: {
    /**
     * Role of the message. This will generally only be present in the first
     * chunk, if at all.
     *
     * When accumulating chunks, `role` deltas should replace any previous role.
     */
    role?: "system" | "user" | "assistant" | "tool";
    /**
     * New content generated since the last chunk.
     *
     * When accumulating chunks, `content` deltas should be concatenated.
     */
    content?: string;
    /**
     * New model reasoning content generated since the last chunk.
     *
     * When accumulating chunks, `reasoningContent` deltas should be
     * concatenated.
     */
    reasoningContent?: string;
    /**
     * New logprobs provided since the last chunk. Note that while each logprob
     * element corresponds to one token, the emitted logprobs cannot be assumed
     * to belong to the current chunk's `content` delta.
     *
     * When accumulating chunks, `logprobs` deltas should be concatenated.
     */
    logprobs?: ChatCompletionLogprob[];
  };
  /**
   * New metadata about the response.
   *
   * When accumulating chunks, `metadata` deltas should be merged with
   * previous metadata, with later values taking precedence.
   */
  metadata?: Record<string, unknown>;
}
