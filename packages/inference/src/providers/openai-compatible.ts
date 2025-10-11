import { safeJson } from "@storyforge/utils";
import {
  bubbleProviderError,
  InferenceProviderCompatibilityError,
  InferenceProviderError,
} from "../errors.js";
import { mergeConsecutiveRoles } from "../transforms.js";
import type {
  ChatCompletionChunk,
  ChatCompletionFinishReason,
  ChatCompletionLogprob,
  ChatCompletionMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderAuth,
  TextInferenceCapabilities,
  TextInferenceGenParams,
} from "../types.js";
import { iterateSSE } from "../utils/sse.js";
import { ProviderAdapter } from "./base.js";

let renderTextTemplateFn: typeof import("../template/jinja.js").renderTextTemplate;

async function getRenderTextTemplate() {
  if (!renderTextTemplateFn) {
    const mod = await import("../template/jinja.js");
    renderTextTemplateFn = mod.renderTextTemplate;
  }
  return renderTextTemplateFn;
}

type ChatRequestMode = "chat" | "text";

interface OpenAIChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
  logprobs?: boolean;
  top_logprobs?: number;
  stream?: boolean;
  // these are prefill hints used variously by vLLM, SGLang, TensorRT-LLM, etc.
  add_generation_prompt?: boolean;
  continue_final_message?: boolean;
}

interface ChatLogprobsContent {
  token: string;
  logprob: number;
  bytes?: number[] | null;
  top_logprobs?: Array<{
    token: string;
    logprob: number;
    bytes?: number[] | null;
  }>;
}

interface OpenAIChatCompletionChoice {
  index: number;
  message?: { role: string; content: string | null };
  finish_reason: string | null;
  logprobs?: { content?: ChatLogprobsContent[] | null };
}

interface OpenAIChatCompletionResponse {
  id?: string;
  object?: string;
  created?: number;
  model: string;
  choices: OpenAIChatCompletionChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface OpenAIChatCompletionStreamChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: Array<{
    index: number;
    delta?: {
      role?: string;
      content?: string | null;
    };
    finish_reason?: string | null;
    logprobs?: { content?: ChatLogprobsContent[] | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface OpenAITextCompletionRequest {
  model: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
  logprobs?: number;
  stream?: boolean;
}

interface OpenAITextCompletionLogprobs {
  tokens?: string[];
  token_logprobs?: number[];
  top_logprobs?: Array<Record<string, number>> | null;
}

interface OpenAITextCompletionChoice {
  text?: string | null;
  index: number;
  finish_reason: string | null;
  logprobs?: OpenAITextCompletionLogprobs | null;
}

interface OpenAITextCompletionResponse {
  id?: string;
  object?: string;
  created?: number;
  model: string;
  choices: OpenAITextCompletionChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface OpenAITextCompletionStreamChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: Array<{
    index: number;
    text?: string | null;
    finish_reason?: string | null;
    logprobs?: OpenAITextCompletionLogprobs | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class OpenAICompatibleAdapter extends ProviderAdapter {
  readonly kind = "openai-compatible";
  private readonly capabilities: TextInferenceCapabilities;
  private readonly genParams: Array<keyof TextInferenceGenParams>;
  private readonly apiUrl: string;

  constructor(
    auth: ProviderAuth,
    baseUrl: string,
    capabilities?: Partial<TextInferenceCapabilities>,
    genParams?: Array<keyof TextInferenceGenParams>
  ) {
    super(auth, baseUrl);

    this.apiUrl = baseUrl.replace(/\/$/, "");

    this.capabilities = {
      streaming: true,
      assistantPrefill: "explicit",
      tools: false,
      fim: false,
      textCompletions: true,
      ...capabilities,
    };

    this.genParams = genParams || [
      "temperature",
      "topP",
      "topK",
      "presencePenalty",
      "frequencyPenalty",
      "topLogprobs",
    ];
  }

  effectiveCapabilities(): TextInferenceCapabilities {
    return this.applyOverrides(this.capabilities);
  }

  supportedParams(): Array<keyof TextInferenceGenParams> {
    return this.genParams;
  }

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const caps = this.effectiveCapabilities();
    const mode = this.resolveMode(request, caps);

    try {
      if (mode === "text") {
        return await this.completeText(request);
      }

      const { prefillMode } = this.preflightCheck(request, caps);
      return await this.completeChat(request, prefillMode);
    } catch (err) {
      bubbleProviderError(err, "OpenAI-compatible request failed");
    }
  }

  async *completeStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<ChatCompletionChunk, ChatCompletionResponse> {
    const caps = this.effectiveCapabilities();
    const mode = this.resolveMode(request, caps);

    if (mode === "text") {
      const { payload, prompt } = await this.buildTextPayload(request, true);

      const headers = this.getHeaders();
      headers.Accept = "text/event-stream";

      const response = await fetch(`${this.apiUrl}/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: request.signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      if (!response.body) {
        throw new InferenceProviderError("No response body from OpenAI-compatible API");
      }

      let accumulatedContent = "";
      let finishReason: ChatCompletionFinishReason = "stop";
      let usage: OpenAITextCompletionResponse["usage"] | undefined;
      const accumulatedLogprobs: ChatCompletionLogprob[] = [];

      try {
        for await (const evt of iterateSSE(response.body)) {
          if (!evt.data) continue;
          const chunk = safeJson<OpenAITextCompletionStreamChunk>(evt.data);
          if (!chunk) continue;

          if (chunk.usage) usage = chunk.usage;
          const choice = chunk.choices?.[0];
          if (!choice) continue;

          if (typeof choice.text === "string" && choice.text.length > 0) {
            accumulatedContent += choice.text;
            yield { delta: { content: choice.text } };
          }

          if (choice.logprobs) {
            const mapped = this.transformTextLogprobs(choice.logprobs);
            if (mapped.length > 0) {
              accumulatedLogprobs.push(...mapped);
              yield { delta: { logprobs: mapped } };
            }
          }

          if (choice.finish_reason) {
            finishReason = this.mapFinishReason(choice.finish_reason);
          }
        }
      } catch (err) {
        bubbleProviderError(err, "OpenAI-compatible streaming error");
      }

      return {
        message: { role: "assistant", content: accumulatedContent },
        finishReason,
        ...(accumulatedLogprobs.length > 0 && { logprobs: accumulatedLogprobs }),
        metadata: {
          provider: "openai-compatible",
          requestMode: "text",
          model: request.model,
          _prompt: payload,
          ...(usage && {
            usage: this.mapUsage(usage),
          }),
          prompt,
        },
      };
    }

    const { prefillMode } = this.preflightCheck(request, caps);
    const { payload } = this.buildChatPayload(request, true, prefillMode);

    const headers = this.getHeaders();
    headers.Accept = "text/event-stream";

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: request.signal,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    if (!response.body) {
      throw new InferenceProviderError("No response body from OpenAI-compatible API");
    }

    let accumulatedContent = "";
    let role: "assistant" | "tool" | undefined;
    let finishReason: ChatCompletionFinishReason = "stop";
    let usage: OpenAIChatCompletionResponse["usage"] | undefined;
    const accumulatedLogprobs: ChatCompletionLogprob[] = [];

    try {
      for await (const evt of iterateSSE(response.body)) {
        if (!evt.data) continue;
        const chunk = safeJson<OpenAIChatCompletionStreamChunk>(evt.data);
        if (!chunk) continue;

        if (chunk.usage) usage = chunk.usage;
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        if (choice.delta?.role) {
          role = choice.delta.role as "assistant" | "tool";
          yield { delta: { role } };
        }

        if (typeof choice.delta?.content === "string") {
          accumulatedContent += choice.delta.content;
          yield { delta: { content: choice.delta.content } };
        }

        if (choice.logprobs?.content) {
          const mapped = this.transformChatLogprobs(choice.logprobs.content);
          if (mapped.length > 0) {
            accumulatedLogprobs.push(...mapped);
            yield { delta: { logprobs: mapped } };
          }
        }

        if (choice.finish_reason) {
          finishReason = this.mapFinishReason(choice.finish_reason);
        }
      }
    } catch (err) {
      bubbleProviderError(err, "OpenAI-compatible streaming error");
    }

    return {
      message: { role: role ?? "assistant", content: accumulatedContent },
      finishReason,
      ...(accumulatedLogprobs.length > 0 && { logprobs: accumulatedLogprobs }),
      metadata: {
        provider: "openai-compatible",
        requestMode: "chat",
        model: request.model,
        _prompt: payload,
        ...(usage && {
          usage: this.mapUsage(usage),
        }),
      },
    };
  }

  async renderPrompt(request: ChatCompletionRequest): Promise<string> {
    const caps = this.effectiveCapabilities();
    const mode = this.resolveMode(request, caps);

    if (mode === "text") {
      const { payload } = await this.buildTextPayload(request, false);
      return JSON.stringify(payload, null, 2);
    }

    const { prefillMode } = this.preflightCheck(request, caps);
    const { payload } = this.buildChatPayload(request, false, prefillMode);
    return JSON.stringify(payload, null, 2);
  }

  override async searchModels(query?: string) {
    if (!this.apiUrl) {
      return [];
    }

    try {
      const response = await fetch(`${this.apiUrl}/models`, {
        method: "GET",
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const models: { id: string; name?: string | null; description?: string | null }[] =
        data.data || [];

      let filtered = models;
      if (query) {
        const lower = query.toLowerCase();
        filtered = models.filter(
          (m) =>
            m.id.toLowerCase().includes(lower) ||
            m.name?.toLowerCase().includes(lower) ||
            m.description?.toLowerCase().includes(lower)
        );
      }

      return filtered.map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        description: m.description ?? null,
      }));
    } catch {
      return [];
    }
  }

  private async completeText(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const { payload, prompt } = await this.buildTextPayload(request, false);

    const response = await fetch(`${this.apiUrl}/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      signal: request.signal,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data: OpenAITextCompletionResponse = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new InferenceProviderError("OpenAI-compatible response contained no choices");
    }

    const messageContent = choice.text ?? "";

    const result: ChatCompletionResponse = {
      message: { role: "assistant", content: messageContent },
      finishReason: this.mapFinishReason(choice.finish_reason),
      metadata: {
        provider: "openai-compatible",
        requestMode: "text",
        model: data.model ?? request.model,
        id: data.id,
        created: data.created,
        _prompt: payload,
        prompt,
        ...(data.usage && {
          usage: this.mapUsage(data.usage),
        }),
      },
    };

    if (choice.logprobs) {
      const mapped = this.transformTextLogprobs(choice.logprobs);
      if (mapped.length > 0) {
        result.logprobs = mapped;
      }
    }

    return result;
  }

  private async completeChat(
    request: ChatCompletionRequest,
    prefillMode: "prefill" | "no-prefill"
  ): Promise<ChatCompletionResponse> {
    const { payload } = this.buildChatPayload(request, false, prefillMode);

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      signal: request.signal,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data: OpenAIChatCompletionResponse = await response.json();
    const choice = data.choices?.[0];

    if (!choice?.message) {
      throw new InferenceProviderError("OpenAI-compatible response contained no message");
    }

    const result: ChatCompletionResponse = {
      message: {
        role: "assistant",
        content: choice.message.content ?? "",
      },
      finishReason: this.mapFinishReason(choice.finish_reason),
      metadata: {
        provider: "openai-compatible",
        requestMode: "chat",
        model: data.model ?? request.model,
        id: data.id,
        created: data.created,
        _prompt: payload,
        ...(data.usage && {
          usage: this.mapUsage(data.usage),
        }),
      },
    };

    if (choice.logprobs?.content) {
      const mapped = this.transformChatLogprobs(choice.logprobs.content);
      if (mapped.length > 0) {
        result.logprobs = mapped;
      }
    }

    return result;
  }

  private resolveMode(
    request: ChatCompletionRequest,
    caps: TextInferenceCapabilities
  ): ChatRequestMode {
    const wantsText = Boolean(request.textTemplate);
    if (wantsText && !caps.textCompletions) {
      throw new InferenceProviderCompatibilityError("Text completions not supported by provider");
    }
    return wantsText ? "text" : "chat";
  }

  private async buildTextPayload(
    request: ChatCompletionRequest,
    stream: boolean
  ): Promise<{ payload: OpenAITextCompletionRequest; prompt: string }> {
    if (!request.textTemplate) {
      throw new InferenceProviderError("Missing text template for text completion");
    }

    const allowPrefill = request.hints?.assistantPrefill !== "forbid";
    const last = request.messages.at(-1);
    const prefix = last?.role === "assistant" && allowPrefill;
    const renderTextTemplate = await getRenderTextTemplate();
    const prompt = await renderTextTemplate(request.textTemplate, {
      messages: request.messages,
      prefix,
    });

    const payload = this.buildTextPayloadFromPrompt(request, prompt, stream);
    return { payload, prompt };
  }

  private buildTextPayloadFromPrompt(
    request: ChatCompletionRequest,
    prompt: string,
    stream: boolean
  ): OpenAITextCompletionRequest {
    const payload: OpenAITextCompletionRequest = {
      model: request.model,
      prompt,
    };

    if (stream) {
      payload.stream = true;
    }

    if (request.maxOutputTokens !== undefined) {
      payload.max_tokens = request.maxOutputTokens;
    }

    if (Array.isArray(request.stop) && request.stop.length > 0) {
      payload.stop = request.stop;
    }

    this.applyGenParamsToText(payload, request.genParams);
    return payload;
  }

  private buildChatPayload(
    request: ChatCompletionRequest,
    stream: boolean,
    prefillMode: "prefill" | "no-prefill"
  ): { payload: OpenAIChatCompletionRequest } {
    const merged = mergeConsecutiveRoles(request.messages);
    const messages: OpenAIChatMessage[] = merged.map(({ role, content }) => ({
      role,
      content,
    }));

    const payload: OpenAIChatCompletionRequest = {
      model: request.model,
      messages,
    };

    if (stream) {
      payload.stream = true;
    }

    // apply prefill hints
    if (prefillMode === "prefill" && this.effectiveCapabilities().assistantPrefill === "explicit") {
      // todo: add some way to let users specify which prefill hint needs to be used
      const lastMsg = messages.at(-1) as ChatCompletionMessage & { prefix?: boolean };
      if (lastMsg?.role === "assistant") {
        payload.add_generation_prompt = false;
        payload.continue_final_message = true;
        lastMsg.prefix = true;
      }
    }

    if (request.maxOutputTokens !== undefined) {
      payload.max_tokens = request.maxOutputTokens;
    }

    if (Array.isArray(request.stop) && request.stop.length > 0) {
      payload.stop = request.stop;
    }

    this.applyGenParamsToChat(payload, request.genParams);

    return { payload };
  }

  private applyGenParamsToChat(
    payload: OpenAIChatCompletionRequest,
    genParams?: TextInferenceGenParams
  ) {
    if (!genParams) return;

    const { temperature, topP, topK, presencePenalty, frequencyPenalty, topLogprobs } = genParams;

    if (this.supportsParam("temperature") && temperature !== undefined) {
      payload.temperature = Math.max(0, Math.min(2, temperature));
    }

    if (this.supportsParam("topP") && topP !== undefined) {
      payload.top_p = Math.max(0, Math.min(1, topP));
    }

    if (this.supportsParam("topK") && topK !== undefined) {
      payload.top_k = Math.max(0, topK);
    }

    if (this.supportsParam("presencePenalty") && presencePenalty !== undefined) {
      payload.presence_penalty = Math.max(-2, Math.min(2, presencePenalty));
    }

    if (this.supportsParam("frequencyPenalty") && frequencyPenalty !== undefined) {
      payload.frequency_penalty = Math.max(-2, Math.min(2, frequencyPenalty));
    }

    if (this.supportsParam("topLogprobs") && topLogprobs !== undefined) {
      payload.logprobs = true;
      payload.top_logprobs = Math.min(20, Math.max(0, Math.floor(topLogprobs)));
    }
  }

  private applyGenParamsToText(
    payload: OpenAITextCompletionRequest,
    genParams?: TextInferenceGenParams
  ) {
    if (!genParams) return;

    const { temperature, topP, topK, presencePenalty, frequencyPenalty, topLogprobs } = genParams;

    if (this.supportsParam("temperature") && temperature !== undefined) {
      payload.temperature = Math.max(0, Math.min(2, temperature));
    }

    if (this.supportsParam("topP") && topP !== undefined) {
      payload.top_p = Math.max(0, Math.min(1, topP));
    }

    if (this.supportsParam("topK") && topK !== undefined) {
      payload.top_k = Math.max(0, topK);
    }

    if (this.supportsParam("presencePenalty") && presencePenalty !== undefined) {
      payload.presence_penalty = Math.max(-2, Math.min(2, presencePenalty));
    }

    if (this.supportsParam("frequencyPenalty") && frequencyPenalty !== undefined) {
      payload.frequency_penalty = Math.max(-2, Math.min(2, frequencyPenalty));
    }

    if (this.supportsParam("topLogprobs") && topLogprobs !== undefined) {
      payload.logprobs = Math.min(20, Math.max(0, Math.floor(topLogprobs)));
    }
  }

  private supportsParam(param: keyof TextInferenceGenParams): boolean {
    return this.genParams.includes(param);
  }

  private mapFinishReason(reason: string | null | undefined) {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "content_filter":
        return "content_filter";
      case "tool_calls":
      case "function_call":
        return "tool_use";
      default:
        return "other";
    }
  }

  private transformChatLogprobs(entries: ChatLogprobsContent[]): ChatCompletionLogprob[] {
    return entries.map((entry) => ({
      token: entry.token,
      logprob: entry.logprob,
      bytes: entry.bytes ?? undefined,
      topLogprobs: entry.top_logprobs?.map((top) => ({
        token: top.token,
        logprob: top.logprob,
        bytes: top.bytes ?? [],
      })),
    }));
  }

  private transformTextLogprobs(
    logprobs: OpenAITextCompletionLogprobs | null
  ): ChatCompletionLogprob[] {
    if (!logprobs?.tokens || !Array.isArray(logprobs.token_logprobs)) {
      return [];
    }

    const tokens = logprobs.tokens;
    return tokens.map((token, index) => {
      const topRaw = logprobs.top_logprobs?.[index];
      const topLogprobs = topRaw
        ? Object.entries(topRaw).map(([tok, value]) => ({
            token: tok,
            logprob: value,
            bytes: [],
          }))
        : undefined;
      return {
        token,
        logprob: logprobs.token_logprobs?.[index] ?? -999,
        topLogprobs,
      };
    });
  }

  private mapUsage(usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  }) {
    return {
      promptTokens: usage.prompt_tokens ?? undefined,
      completionTokens: usage.completion_tokens ?? undefined,
      totalTokens: usage.total_tokens ?? undefined,
    };
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const statusText = `${response.status} ${response.statusText}`.trim();
    let errorMessage = statusText;
    const body = await response.text();

    if (body) {
      try {
        const parsed = JSON.parse(body);
        if (parsed?.error?.message) {
          errorMessage = parsed.error.message;
        } else if (parsed?.error) {
          errorMessage = JSON.stringify(parsed.error);
        } else {
          errorMessage = body;
        }
      } catch {
        errorMessage = body;
      }
    }

    throw new InferenceProviderError(`OpenAI-compatible API error: ${errorMessage}`);
  }
}
