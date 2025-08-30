import { ProviderAdapter } from "@/providers/base";
import type {
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderAuth,
  ProviderModelSearchResult,
  TextInferenceCapabilities,
  TextInferenceGenParams,
} from "@/types";

interface MockResponse {
  /** Response text to return */
  text: string;
  /** Optional metadata to include in response */
  metadata?: Record<string, unknown>;
  /** Delay before starting response (ms) */
  delay?: number;
  /** For streaming: delay between chunks (ms) */
  chunkDelay?: number;
  /** For streaming: number of words per chunk */
  wordsPerChunk?: number;
}

interface MockResponsePattern {
  /** Pattern to match against the last user message content */
  pattern: string | RegExp;
  /** Response configuration for this pattern */
  response: MockResponse;
}

interface MockProviderConfig {
  /** Default response when no patterns match */
  defaultResponse?: MockResponse;
  /** Pattern-based responses */
  patterns?: MockResponsePattern[];
  /** Model-specific responses */
  modelResponses?: Record<string, MockResponse>;
  /** Available mock models */
  models?: string[];
  /** Global streaming settings */
  streaming?: {
    defaultChunkDelay?: number;
    defaultWordsPerChunk?: number;
  };
}

export class MockAdapter extends ProviderAdapter {
  readonly kind = "mock";
  private readonly config: Required<MockProviderConfig> & {
    streaming: Required<NonNullable<MockProviderConfig["streaming"]>>;
  };

  constructor(auth: ProviderAuth, config: MockProviderConfig = {}) {
    super(auth);

    const defaultStreaming = {
      defaultChunkDelay: 50,
      defaultWordsPerChunk: 3,
    };

    this.config = {
      defaultResponse: config.defaultResponse ?? {
        text: "This is a mock response from the MockProvider. The request was processed successfully.",
        delay: 100,
        chunkDelay: 50,
        wordsPerChunk: 3,
      },
      patterns: config.patterns ?? [],
      modelResponses: config.modelResponses ?? {
        "mock-fast": {
          text: "Quick mock response for fast testing.",
          delay: 10,
          chunkDelay: 10,
          wordsPerChunk: 5,
        },
        "mock-slow": {
          text: "This is a deliberately slow mock response to simulate high-latency scenarios and test timeout handling.",
          delay: 500,
          chunkDelay: 200,
          wordsPerChunk: 2,
        },
        "mock-creative": {
          text: "Once upon a time, in a digital realm far, far away, there lived a mock provider who dreamed of generating the most creative and engaging responses. This provider had the magical ability to simulate any LLM behavior, making it perfect for testing narrative engines and story generation systems.",
          delay: 150,
          chunkDelay: 80,
          wordsPerChunk: 4,
        },
        "mock-error": {
          text: "This response simulates an error scenario.",
          delay: 100,
        },
      },
      models: config.models ?? [
        "mock-fast",
        "mock-slow",
        "mock-creative",
        "mock-error",
        "mock-default",
      ],
      streaming: {
        defaultChunkDelay:
          config.streaming?.defaultChunkDelay ??
          defaultStreaming.defaultChunkDelay,
        defaultWordsPerChunk:
          config.streaming?.defaultWordsPerChunk ??
          defaultStreaming.defaultWordsPerChunk,
      },
    };

    // Add built-in patterns for common test scenarios
    this.config.patterns.push(
      {
        pattern: /pirate|ship|captain|treasure/i,
        response: {
          text: "Ahoy there, matey! Ye be speakin' of pirates and ships? Aye, I know tales of the seven seas and treasures beyond imagination. What adventure be ye seekin' today?",
          delay: 120,
          chunkDelay: 60,
          wordsPerChunk: 3,
        },
      },
      {
        pattern: /story|narrative|character|plot/i,
        response: {
          text: "Ah, you're interested in storytelling! Let me craft something for you. Every great story needs compelling characters, an engaging plot, and a world that feels alive. Whether it's fantasy, sci-fi, or contemporary fiction, the key is to create emotional connections between your audience and your characters.",
          delay: 100,
          chunkDelay: 70,
          wordsPerChunk: 4,
        },
      },
      {
        pattern: /test|debug|mock/i,
        response: {
          text: "You've discovered the mock provider! This is perfect for testing and development. I can simulate various response patterns, delays, and behaviors without making real API calls.",
          delay: 50,
          chunkDelay: 40,
          wordsPerChunk: 3,
        },
      }
    );
  }

  defaultCapabilities(): TextInferenceCapabilities {
    return {
      streaming: true,
      assistantPrefill: "implicit",
      tools: false,
      fim: false,
    };
  }

  supportedParams(): Array<keyof TextInferenceGenParams> {
    return ["temperature"];
  }

  async complete(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    const capabilities = this.defaultCapabilities();
    this.preflightCheck(request, capabilities);

    const mockResponse = this.selectResponse(request);

    // Simulate network delay
    if (mockResponse.delay && mockResponse.delay > 0) {
      await this.sleep(mockResponse.delay);
    }

    // Handle error simulation
    if (request.model === "mock-error") {
      throw new Error("Mock error: Simulated API failure");
    }

    // Apply maxTokens if specified
    let responseText = mockResponse.text;
    if (request.maxTokens) {
      const words = responseText.split(" ");
      if (words.length > request.maxTokens) {
        responseText = `${words.slice(0, request.maxTokens).join(" ")}...`;
      }
    }

    return {
      message: {
        role: "assistant",
        content: responseText,
      },
      finishReason: "stop",
      metadata: {
        model: request.model,
        provider: "mock",
        ...mockResponse.metadata,
      },
    };
  }

  async *completeStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<ChatCompletionChunk, ChatCompletionResponse> {
    const capabilities = this.defaultCapabilities();
    this.preflightCheck(request, capabilities);

    const mockResponse = this.selectResponse(request);

    // Initial delay
    if (mockResponse.delay && mockResponse.delay > 0) {
      await this.sleep(mockResponse.delay);
    }

    // Handle error simulation
    if (request.model === "mock-error") {
      throw new Error("Mock error: Simulated streaming API failure");
    }

    let responseText = mockResponse.text;

    // Apply maxTokens if specified
    if (request.maxTokens) {
      const words = responseText.split(" ");
      if (words.length > request.maxTokens) {
        responseText = `${words.slice(0, request.maxTokens).join(" ")}...`;
      }
    }

    // Chunk the response
    const words = responseText.split(" ");
    const wordsPerChunk =
      mockResponse.wordsPerChunk ?? this.config.streaming.defaultWordsPerChunk;
    const chunkDelay =
      mockResponse.chunkDelay ?? this.config.streaming.defaultChunkDelay;

    let accumulatedText = "";

    yield { delta: { role: "assistant" as const } };

    for (let i = 0; i < words.length; i += wordsPerChunk) {
      const chunk = words.slice(i, i + wordsPerChunk).join(" ");
      const chunkText = i + wordsPerChunk >= words.length ? chunk : `${chunk} `;

      accumulatedText += chunkText;
      yield { delta: { content: chunkText } };

      // Don't delay after the last chunk
      if (i + wordsPerChunk < words.length && chunkDelay > 0) {
        await this.sleep(chunkDelay);
      }
    }

    const meta = {
      model: request.model,
      provider: "mock",
      ...mockResponse.metadata,
    };
    yield { metadata: meta };

    // Return the final accumulated response
    return {
      message: { role: "assistant" as const, content: accumulatedText },
      finishReason: "stop" as const,
      metadata: meta,
    };
  }

  renderPrompt(request: ChatCompletionRequest): string {
    return JSON.stringify(
      {
        mockProvider: true,
        model: request.model,
        messages: request.messages,
        selectedResponse: this.selectResponse(request),
      },
      null,
      2
    );
  }

  override async searchModels(
    query?: string
  ): Promise<ProviderModelSearchResult[]> {
    let models = [...this.config.models];

    if (query) {
      const filterLower = query.toLowerCase();
      models = models.filter((id) => id.toLowerCase().includes(filterLower));
    }

    return models.map((id) => ({
      id,
      name: id,
      description: `Mock model: ${id}`,
      tags: ["mock", "test"],
    }));
  }

  private selectResponse(request: ChatCompletionRequest): MockResponse {
    // Check model-specific responses first
    const modelResponse = this.config.modelResponses[request.model];
    if (modelResponse) {
      return modelResponse;
    }

    // Check pattern-based responses
    const lastUserMessage = [...request.messages]
      .reverse()
      .find((msg) => msg.role === "user");

    if (lastUserMessage) {
      for (const pattern of this.config.patterns) {
        const match =
          typeof pattern.pattern === "string"
            ? lastUserMessage.content
                .toLowerCase()
                .includes(pattern.pattern.toLowerCase())
            : pattern.pattern.test(lastUserMessage.content);

        if (match) {
          return pattern.response;
        }
      }
    }

    // Fall back to default response
    return this.config.defaultResponse;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Add a new response pattern at runtime
   */
  addPattern(pattern: string | RegExp, response: MockResponse): void {
    this.config.patterns.push({ pattern, response });
  }

  /**
   * Add or update a model-specific response
   */
  setModelResponse(model: string, response: MockResponse): void {
    this.config.modelResponses[model] = response;
    if (!this.config.models.includes(model)) {
      this.config.models.push(model);
    }
  }

  /**
   * Get current configuration (useful for debugging)
   */
  getConfig(): MockProviderConfig {
    return { ...this.config };
  }
}
