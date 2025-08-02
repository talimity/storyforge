/* very much not final */
export type GenerationContextSectionRole =
  | "system"
  | "reference"
  | "history"
  | "task";
export interface GenerationContextSection {
  id: string;
  content: string;
  metadata?: {
    tokenCount?: number;
    priority?: number;
    role?: GenerationContextSectionRole;
  };
}

export interface InferenceParameters {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  // topP?: number;
  // presencePenalty?: number;
  // frequencyPenalty?: number;
}

export interface GenerationContext {
  sections: GenerationContextSection[];
  parameters: InferenceParameters;
  model: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  parameters: InferenceParameters;
  model: string;
}

export interface ProviderCapabilities {
  /** Whether the provider supports prefilling/prefixing the assistant's response */
  supportsPrefill: boolean;
  /** Whether the provider supports streaming responses */
  supportsStreaming: boolean;
  /** The set of supported inference parameters */
  supportedParameters: Set<keyof InferenceParameters>;
}

export interface GenerationResult {
  /** The generated text content */
  text: string;
  /** Additional metadata about the generation */
  metadata?: Record<string, unknown>;
}

export interface GenerationResultDelta {
  /** New text content to be appended */
  text?: string;
  /** New fields to be merged into the existing metadata */
  metadata?: Record<string, unknown>;
}

export interface LLMProvider {
  id: string;
  name: string;

  /** Returns a list of model IDs supported by the provider. */
  listModels(filter?: string): Promise<string[]>;

  /** Requests text generation from the provider. */
  generate(request: ChatCompletionRequest): Promise<GenerationResult>;

  /** Requests text generation with streaming updates. */
  generateStream(
    request: ChatCompletionRequest
  ): AsyncIterable<GenerationResultDelta, GenerationResult>;

  /** Returns the serialized payload for a given ChatCompletionRequest without making a request. */
  renderPrompt(request: ChatCompletionRequest): string;
}
