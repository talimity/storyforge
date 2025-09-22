# 03 — OpenAI‑Compatible Adapter: Chat + Text Paths

Goal: implement the `openai-compatible` adapter for both chat completions and text completions, switching per request based on the presence of a Jinja template and provider capabilities.

Use `packages/inference/docs/provider-specs/vllm-openai-compat.yaml` as a reference for types and API request/response.

## Routing Logic

- Adapter decides `requestMode` at call time:

```ts
const caps = this.defaultCapabilities();
const wantsText = Boolean(request.textTemplate);
if (wantsText && !caps.textCompletions) {
  throw new InferenceProviderCompatibilityError("Text completions not supported by provider");
}
const mode = wantsText ? "text" : "chat" as const;
```

- For `mode === "text"`:
  - Compute `prefix`:
    - True when last message role is `assistant` and `hints.assistantPrefill !== 'forbid'`.
    - This mirrors runner semantics but is local to the adapter; no message pruning.
  - Render Jinja with `{ messages, prefix }` using `renderTextTemplate`.
  - POST to `"/v1/completions"` (i.e., `${baseUrl}/completions`) with payload below.

- For `mode === "chat"`:
  - Transform `messages` into OpenAI chat shape.
  - Apply preflight for assistant prefill rules (as today in other adapters).
    - If assistant prefill hint is `"explicit"`, the outbound API request should include `add_generation_prompt: false`. This matches the standard @huggingface/transformers `apply_chat_template` expectations. 
  - POST to `/v1/chat/completions`.

## Request/Response Mapping (Text Mode)

Request payload (OpenAI‑style Completions):

```ts
interface OpenAICompletionsRequest {
  model: string;
  prompt: string;        // from Jinja renderer
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
  logprobs?: number | boolean; // if top_logprobs requested
  stream?: boolean;
}
```

Non‑streaming mapping:

```ts
// response.choices[0].text → ChatCompletionResponse.message.content
// response.choices[0].finish_reason → finishReason
// response.usage → metadata.usage (promptTokens, completionTokens, totalTokens)
```

Streaming mapping:

```ts
// SSE data chunks with { choices: [{ text, finish_reason? }] }
yield { delta: { content: textChunk } };
// Aggregate content; on stream end, return ChatCompletionResponse
```

## Request/Response Mapping (Chat Mode)

Largely mirrors `openrouter.ts`/`deepseek.ts` patterns:

- Messages: merge consecutive roles if needed; map to `{ role, content }`.
- Gen params → OpenAI fields (clamp ranges; drop unsupported).
- `hints` → preflight for assistant prefill; if provider can’t satisfy, throw compatibility error.
- Streaming: handle `delta.content`; return aggregated response at end.

## Metadata & Debugging

- Add to `metadata` for both modes:
  - `provider: "openai-compatible"`
  - `requestMode: "text" | "chat"`
  - `_prompt`: exact payload (body) sent to the upstream API (safe to log for debugging).

## File Touches

- `packages/inference/src/providers/openai-compatible.ts`
  - Implement `complete`, `completeStream`, `transformRequest` for both modes (text/chat) or split into two private helpers: `buildChatPayload`, `buildTextPayload`.
  - Import and use `renderTextTemplate` and error helpers.

## Guardrails

- Do not modify or reorder the incoming `messages` specifically for text mode templates; pass verbatim to Jinja.
- Fail fast if `textTemplate` present but `caps.textCompletions` is false.
- Respect `AbortSignal` in both fetch calls.
- Clamp numeric params to plausible ranges (e.g., `top_logprobs` ≤ 20) similarly to other adapters.

## Acceptance Checklist

- Unit tests cover:
  - Mode selection behavior (no template → chat; template + caps → text; template + no caps → error).
  - SSE streaming mapping for both endpoints.
  - Finish reason mapping and usage metadata.
  - Prefix true/false inputs reflected into template rendering without changing messages.
