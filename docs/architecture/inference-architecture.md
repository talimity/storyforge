# StoryForge Inference Architecture

## Purpose
This document describes StoryForge’s inference layer: the abstractions that hide provider differences, the preparation steps that guard against capability mismatches, and the way upstream systems (workflows, intent engine, diagnostics) interact with it.

## High-Level Structure
- **Provider adapters** implement a common interface (`ProviderAdapter`) for invoking model APIs (OpenAI-compatible, OpenRouter, DeepSeek, Mock, etc.).
- **Provider factory** (`createAdapter`) builds adapters from persisted configuration (`ProviderConfig`), injecting API keys, base URLs, and optional capability overrides.
- **Capabilities & preflights** encode what each provider can do (streaming, assistant prefill, tools, text completion) and validate each request before it leaves the process.
- **Request/response contracts** define provider-agnostic chat completion messages, streaming chunks, logprob payloads, and finish reasons.
- **Utilities** (SSE iterator, prompt transforms, Jinja text templating) support adapters that need to massage prompts or parse streamed events.

These pieces let the rest of the application talk in terms of `ChatCompletionRequest` and `ProviderAdapter` without caring which API is backing the call.

## Provider Configuration & Creation
`ProviderConfig` objects come from database model profiles. They store:
- `kind`: adapter type (`openrouter`, `deepseek`, `openai-compatible`, `mock`).
- `auth`: API key, org ID, or custom headers.
- Optional `baseUrl`, capability overrides, and a whitelist of supported generation parameters.

`createAdapter` switches on `kind` to instantiate the matching subclass, injecting auth and base URL. For OpenAI-compatible providers the base URL is mandatory; others default to public endpoints. Callers can ask `getDefaultCapabilities(kind)` to seed UI or validation before a profile is configured.

At runtime, the workflow runner loads the model profile attached to a workflow step, calls `createAdapter`, and then `.withOverrides(profile.capabilityOverrides)` so per-model tweaks adjust behaviour without modifying global defaults.

## Provider Adapter Contract
Every adapter extends `ProviderAdapter` and must implement:
- `effectiveCapabilities()` → merges base capabilities with any overrides.
- `supportedParams()` → which `genParams` keys the provider understands.
- `complete()` and `completeStream()` → single-shot and streaming inference calls that return/emit provider-agnostic responses.
- `renderPrompt()` → optional hook to render a text-completion template when the model expects raw text instead of chat turns.

Base-class features:
- `preflightCheck()` uses capability metadata (currently assistant prefill) to reject requests that the provider cannot fulfil.
- `withOverrides()` stores per-model capability tweaks (e.g., marking a specific OpenRouter model as not supporting prefill).
- `getHeaders()` builds default HTTP headers, inserting Bearer tokens and extra headers without each adapter replicating boilerplate.

Adapters also expose `searchModels()` to support model discovery UIs.

## Capabilities & Prefill Logic
`TextInferenceCapabilities` describe features the runner relies on: streaming support, how assistant prefill works (`implicit`, `explicit`, `unsupported`), tool availability, FIM support, and text completion support. Capabilities sit alongside `TextInferenceGenParams`, which cover optional sampling controls (temperature, top-p/k, penalties, logprobs).

Before dispatching a request, adapters call `preflightPrefill(request, capabilities)`. The helper inspects:
- Prompt semantics (does the last message come from the assistant?).
- Request hints (`assistantPrefill: require | auto | forbid`).
- Provider behaviour (prefill implicit, explicit, or unsupported).

If a conflict exists (e.g., template requires prefill but provider cannot prefill) the adapter throws `InferenceProviderCompatibilityError`. This keeps higher layers from sending incompatible prompts and receiving garbled model output.

## Request & Response Model
The inference package defines provider-neutral payloads that all adapters honour:
- `ChatCompletionRequest` contains chat messages, model ID, stop sequences, `maxOutputTokens`, optional sampling params, hints, cancellation signal, and an optional text template.
- `ChatCompletionResponse` returns the assistant message, finish reason, optional reasoning text, logprobs, and arbitrary metadata.
- `ChatCompletionChunk` describes streaming deltas (content, role, reasoning, logprobs, metadata). The workflow runner aggregates these, emitting telemetry (`stream_delta`) and composing a final response if the provider omits one.

Logprob structures capture both chosen tokens and top alternatives so downstream analytics can inspect model choices when providers support it.

## Error Handling
- `InferenceProviderError` wraps unexpected provider failures with optional causes.
- `InferenceProviderCompatibilityError` reports preflight/capability mismatches.
- `bubbleProviderError()` normalises thrown values: it preserves already-wrapped provider errors, maps `AbortError` to a friendly message, and otherwise wraps the original error with additional context.

Adapters should catch HTTP/JSON issues, call `bubbleProviderError`, and throw consistent errors back to the workflow runner. The runner propagates these as `run_error` events and rejects the workflow result promise.

## Utilities & Supporting Modules
- **`renderTextTemplate`**: Uses Jinja syntax (via `@huggingface/jinja`) to render provider-specific text completion prompts (e.g., when an OpenAI-compatible server offers better text completion semantics). Inputs include the chat history and whether the last assistant message should be treated as a prefix.
- **`mergeConsecutiveRoles`**: Collapses adjacent messages with the same role, simplifying adapters that need strictly alternating roles.
- **`iterateSSE`**: Async generator that parses Server-Sent Event streams, handling CRLF, id/retry fields, and `[DONE]` sentinels. OpenAI-style streaming adapters rely on this to iterate chunks safely.
- **`preflights.ts`**: Houses the prefilling logic; easy to extend with additional capability checks (tool support, streaming requirement) later.

## Provider Implementations (Snapshot)
- **OpenAICompatibleAdapter**: Talks to any OpenAI-like REST API (OpenAI, vLLM, SGLang). It supports both chat and text-completions (`ChatRequestMode`), optional assistant prefill hints (`add_generation_prompt`, `continue_final_message`), streaming via SSE, logprobs parsing, and JSON parsing using `safeJson`. Generation parameters are filtered against the adapter’s configured whitelist. Capability overrides can downgrade features (e.g., mark a specific endpoint as non-streaming).
- **OpenRouterAdapter**: Targets OpenRouter’s API, inheriting base behaviour but translating OpenRouter’s terminology and streaming format.
- **DeepseekAdapter**: Similar to OpenAI but with DeepSeek-specific endpoint URLs and parameter mapping.
- **MockAdapter**: Lightweight adapter used for tests and offline workflows; echoes canned responses and reports broad capabilities so feature paths can run without a network call.

All adapters share the preflight/capability machinery and return the same response shapes, allowing higher layers to treat them interchangeably.

## Integration with Workflows & Intent Engine
1. The workflow runner loads a model profile from the database (via `WorkflowDeps.loadModelProfile`). The profile contains `providerId`, model ID, optional capability overrides, default sampling params, and an optional text template.
2. `WorkflowRunnerManager` hands the profile to `createAdapter`, then applies overrides via `.withOverrides()` and passes the adapter to the runner.
3. During step execution the runner:
   - Renders a prompt, optionally merges consecutive roles, and derives assistant-prefill hints.
   - Builds a `ChatCompletionRequest` (with `signal` to support cancellation) and calls `adapter.completeStream()`.
   - Emits streaming deltas to subscribers (UI, telemetry recorder) and aggregates the final `ChatCompletionResponse` for output capture.
4. Intent execution pipelines rely on the workflow runner to generate turns; the inference layer ensures provider quirks do not leak back into timeline/intent logic.
5. Diagnostics modules (generation recorder, prompt testing tools) reuse the same adapters so captured telemetry matches real execution behaviour.

## Design Principles & Extension Points
- **Single adapter surface**: All providers look the same to callers. Adding a new vendor means implementing one class and registering it in `createAdapter`.
- **Capability-driven validation**: By checking requests up front, we avoid hard-to-debug model behaviour (e.g., providers inserting blank assistant prefixes) and can fail fast with clear errors.
- **Streaming-first design**: Every adapter implements streaming; synchronous completion is icing. This keeps event streams and UI feedback consistent.
- **Text-template support**: Providers that prefer text completions can render Jinja templates instead of forcing chat semantics, widening model compatibility.
- **Composable overrides**: Model profiles can fine-tune capability flags without duplicating adapters, letting administrators disable features model-by-model.
- **Utility reuse**: SSE parsing, template rendering, and role-merging live centrally, reducing duplication across adapters.

Future work—tool call support, provider-specified cost tracking, structured output validation—can slot into the existing contract by extending capabilities, request types, and adapter implementations without rewriting upstream workflow code.
