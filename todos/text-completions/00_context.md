# Text Completions Support — Context & Decisions

This mini‑project adds first‑class support for “text completions” in StoryForge without changing anything above the `@storyforge/inference` layer. Upstream features, workflows, and prompt rendering continue to operate on chat messages; only provider adapters in the inference layer decide whether to translate an incoming chat request into a text‑completion request.

## Current State (observed)

- Runner (`packages/gentasks/src/runner/runner.ts`)
  - Renders a chat `messages` array using the prompt engine, builds a `ChatCompletionRequest`, streams a response via the provider adapter, aggregates deltas, applies transforms, and captures outputs. It derives `hints.assistantPrefill` from the last message’s `prefix` flag.
  - It always uses the provider chosen by the model profile, which can inject per‑model capability overrides via `.withOverrides()`.

- Inference (`packages/inference`)
  - Provider adapters: `openrouter.ts` and `deepseek.ts` are chat‑first and production‑ready; `openai-compatible.ts` is stubbed; `mock.ts` simulates chat.
  - Capability system (`TextInferenceCapabilities`) exists and is used by preflights (e.g., assistant prefill handling) before sending requests.
  - `ChatCompletionRequest` contains `messages`, `model`, `maxOutputTokens`, `stop`, `genParams`, `hints`, `signal`.
  - Utilities: SSE parser, transforms, preflights, error normalization.

- DB/Contracts
  - Provider configs (`packages/db/src/schema/provider-config.ts`) store `kind`, `auth`, `baseUrl`, and `capabilities` JSON (only for `openai-compatible` per DB constraint).
  - Model profiles (`packages/db/src/schema/model-profiles.ts`) store `providerId`, `modelId`, `displayName`, and per‑model `capabilityOverrides` JSON.
  - API contracts mirror the above in `packages/contracts/src/schemas/provider.ts`.

## Guiding Requirements

- Upstream layers keep producing chat `messages`; no changes to the workflow or prompt rendering contract.
- Text completions are activated per request when a model profile provides a Jinja template and the provider supports text completions.
- Templates are rendered by a small helper provided by the inference package (isomorphic, using `@huggingface/jinja`).
- For text mode, the template receives two inputs:
  - `messages`: the chat messages array (unchanged; not pruned/merged by the runner just for templates).
  - `prefix`: boolean indicating assistant continuation (derived exactly like the runner’s `hints`—true when last message role is `assistant` and prefill is desired). The template itself decides how to omit or include an assistant header.

## Design Decision

We will use a unified provider kind approach (no new kinds like `openai-compatible-text`).

- The provider adapter decides at runtime between chat vs text mode:
  - If `request.textTemplate` is present and capabilities indicate `textCompletions: true`, it renders the template and hits the text completions endpoint.
  - Otherwise it uses the chat completions endpoint.

### Why unified is better here

- Keeps user configuration simple (one provider row; no duplication of auth/baseUrl).
- Avoids kind sprawl and duplicated code in adapters/factory.
- Leverages existing capabilities/overrides and runner integration with minimal changes.

## Changes at a Glance

1) Types/Schema
- Add `textCompletions: boolean` to `TextInferenceCapabilities` + Zod schema.
- Add `textTemplate?: string` to `ChatCompletionRequest` (carried from model profile). No other upstream changes.
- Add nullable `text_template` column to `model_profiles` and wire it through contracts and the runner’s resolved profile type.

2) Inference Renderer
- New `renderTextTemplate(template, { messages, prefix })` helper in `@storyforge/inference`, using `@huggingface/jinja`. Export it for UI preview.

3) Adapters
- Implement `openai-compatible` adapter for BOTH chat and text modes, with streaming and non‑streaming mapping. Endpoints assumed per OpenAI compatibility: `/v1/chat/completions` for chat, `/v1/completions` for text.
- `openrouter` and `deepseek` ignore `textTemplate` (capability `textCompletions: false`).

4) Runner
- When building the request, include `textTemplate` from the model profile (no other changes). The adapter chooses the path.

5) UI Preview
- Add a template editor + preview using the exported `renderTextTemplate`. Inputs shown: `messages` (from a sample context) and `prefix`.

## Edge Cases & Policies

- Prefill in chat mode still governed by provider capability + preflight (unchanged). In text mode, `prefix` is only a data input for the template; no provider prefill flag is needed.
- If a `textTemplate` is present but the provider has `textCompletions: false`, the adapter fails fast with an `InferenceProviderCompatibilityError` (clearer than silent fallback to chat).
- Streaming normalization:
  - Chat SSE → `delta.content` (as today).
  - Text SSE → `choices[0].text` chunks mapped to `delta.content`.
- Logprobs are best‑effort mapped in both modes (optional in response).

## Out of Scope (for this feature set)

- Tools/functions, vision input, or structured output for text mode templates.
- Changing prompt rendering semantics or message authorship upstream.
- Non OpenAI‑style text completion providers beyond the generic OpenAI‑compatible path (we can extend later).
