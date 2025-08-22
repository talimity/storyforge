/**
 * Defines the text inference capabilities of a model or inference provider.
 */
export type TextInferenceCapabilities = {
  /** Whether tokens can be streamed as they are generated. */
  streaming: boolean;
  /** Whether the assistant message can be prefilled to guide generation. */
  assistantPrefill: boolean;
  /** Whether logprobs can be requested for generated tokens. */
  logprobs: boolean;
  /** Whether tool use is supported. */
  tools: boolean;
  /** Whether filling in the middle of text is supported. */
  fim: boolean;

  // TODO: guided generation, `n` for parallel generations, etc.
};

export type ProviderKind = "openrouter" | "deepseek" | "openai-compatible";
