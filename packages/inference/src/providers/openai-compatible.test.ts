import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InferenceProviderCompatibilityError } from "../errors.js";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  TextInferenceCapabilities,
} from "../types.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";

const BASE_URL = "https://example.com/v1";

function createAdapter(partialCaps?: Partial<TextInferenceCapabilities>) {
  return new OpenAICompatibleAdapter({ apiKey: "test-key" }, BASE_URL, partialCaps);
}

function createSSEStream(events: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

function baseRequest(): ChatCompletionRequest {
  return {
    model: "example-model",
    messages: [
      { role: "system", content: "You are terse" },
      { role: "user", content: "Hello" },
    ],
    maxOutputTokens: 64,
    stop: [],
    genParams: { temperature: 0.5 },
  };
}

describe("OpenAICompatibleAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes chat completions when no text template is provided", async () => {
    const adapter = createAdapter();
    const fetchMock = vi.mocked(globalThis.fetch);

    const responsePayload = {
      id: "chat-123",
      object: "chat.completion",
      created: 1,
      model: "example-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hi there" },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 4,
        total_tokens: 14,
      },
    };

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const request: ChatCompletionRequest = {
      ...baseRequest(),
      messages: [
        { role: "system", content: "You are terse" },
        { role: "assistant", content: "Prefill" },
      ],
      hints: { assistantPrefill: "require" },
    };

    const result = await adapter.complete(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/chat/completions`);
    const body = JSON.parse(init!.body as string);
    expect(body.continue_final_message).toBe(true);
    expect(result.message.content).toBe("Hi there");
    expect(result.metadata?.provider).toBe("openai-compatible");
    expect(result.metadata?.requestMode).toBe("chat");
    expect(result.metadata?.usage).toEqual({
      promptTokens: 10,
      completionTokens: 4,
      totalTokens: 14,
    });
  });

  it("routes text completions when a template is present", async () => {
    const adapter = createAdapter();
    const fetchMock = vi.mocked(globalThis.fetch);

    const responsePayload = {
      id: "text-123",
      object: "text_completion",
      created: 2,
      model: "example-model",
      choices: [
        {
          index: 0,
          text: "false::Hello",
          finish_reason: "stop",
        },
      ],
    };

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const request: ChatCompletionRequest = {
      ...baseRequest(),
      textTemplate: "{{ prefix }}::{{ messages[-1].content }}",
    };

    const result = await adapter.complete(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/completions`);
    const body = JSON.parse(init!.body as string);
    expect(body.prompt).toBe("false::Hello");
    expect(result.message.content).toBe("false::Hello");
    expect(result.metadata?.requestMode).toBe("text");
  });

  it("throws when text completions are not supported", async () => {
    const adapter = createAdapter({ textCompletions: false });

    await expect(
      adapter.complete({
        ...baseRequest(),
        textTemplate: "hello",
      })
    ).rejects.toBeInstanceOf(InferenceProviderCompatibilityError);
  });

  it("streams text completions via SSE", async () => {
    const adapter = createAdapter();
    const fetchMock = vi.mocked(globalThis.fetch);

    const stream = createSSEStream([
      { choices: [{ index: 0, text: "Hello" }] },
      {
        choices: [
          {
            index: 0,
            text: " world",
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 2,
          total_tokens: 7,
        },
      },
    ]);

    fetchMock.mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    const request: ChatCompletionRequest = {
      ...baseRequest(),
      textTemplate: "{{ messages[-1].content }}",
    };

    const generator = adapter.completeStream(request);
    const iterator = generator[Symbol.asyncIterator]();
    const deltas: string[] = [];
    let finalResponse: ChatCompletionResponse | undefined;

    while (true) {
      const { value, done } = await iterator.next();
      if (done) {
        finalResponse = value;
        break;
      }
      if (value.delta?.content) {
        deltas.push(value.delta.content);
      }
    }

    expect(deltas.join("")).toBe("Hello world");
    expect(finalResponse?.message.content).toBe("Hello world");
    expect(finalResponse?.metadata?.requestMode).toBe("text");
    expect(finalResponse?.metadata?.usage).toEqual({
      promptTokens: 5,
      completionTokens: 2,
      totalTokens: 7,
    });
  });

  it("streams chat completions via SSE", async () => {
    const adapter = createAdapter();
    const fetchMock = vi.mocked(globalThis.fetch);

    const stream = createSSEStream([
      { choices: [{ index: 0, delta: { role: "assistant" } }] },
      { choices: [{ index: 0, delta: { content: "Hi" } }] },
      {
        choices: [
          {
            index: 0,
            delta: { content: "!" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 6,
          completion_tokens: 2,
          total_tokens: 8,
        },
      },
    ]);

    fetchMock.mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    const request: ChatCompletionRequest = {
      ...baseRequest(),
      messages: [
        { role: "system", content: "Be brief" },
        { role: "user", content: "Say hi" },
      ],
    };

    const generator = adapter.completeStream(request);
    const iterator = generator[Symbol.asyncIterator]();
    const deltas: string[] = [];
    let finalResponse: ChatCompletionResponse | undefined;

    while (true) {
      const { value, done } = await iterator.next();
      if (done) {
        finalResponse = value;
        break;
      }
      if (value.delta?.content) {
        deltas.push(value.delta.content);
      }
    }

    expect(deltas.join("")).toBe("Hi!");
    expect(finalResponse?.message.content).toBe("Hi!");
    expect(finalResponse?.metadata?.requestMode).toBe("chat");
    expect(finalResponse?.metadata?.usage).toEqual({
      promptTokens: 6,
      completionTokens: 2,
      totalTokens: 8,
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers((init?.headers ?? {}) as HeadersInit);
    expect(headers.get("Accept")).toBe("text/event-stream");
  });
});
