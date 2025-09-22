# 05 — Tests, Migration, and Rollout Plan

Goal: ensure the feature is covered by unit tests, ship DB migration safely, and document verification steps.

## Unit Tests

1) Inference: Jinja renderer
- File: `packages/inference/src/template/jinja.test.ts`
  - Renders a simple template using `messages` and `prefix`.
  - Confirms no mutation of inputs and expected output string.

2) OpenAI‑compatible adapter
- Non‑streaming (chat): verify payload shape and response mapping.
- Streaming (chat): parse SSE chunks → `delta.content` aggregation.
- Non‑streaming (text): with `textTemplate`, assert `/v1/completions` payload and mapping of `choices[0].text`.
- Streaming (text): parse SSE chunks with `choices[].text`.
- Mode selection matrix:
  - No template → chat
  - Template + `textCompletions: true` → text
  - Template + `textCompletions: false` → capability error

3) Runner integration (mocked adapters)
- Extend existing runner tests to include a model profile that carries a `textTemplate` and assert the adapter is invoked in text mode (e.g., by inspecting returned `metadata.requestMode`).

## DB Migration

- Add `text_template` to `model_profiles` (see 01 doc). Run:

```
pnpm db:generate --name=text-template-on-model-profiles
pnpm db:migrate
```

## Rollout & Verification

- Manual smoke tests with a known OpenAI‑compatible provider (e.g., local proxy or public API):
  - Chat workflow (no template): content streams; finishReason maps; usage present when available.
  - Text workflow (with template): template renders; `/v1/completions` endpoint used; streaming works; output identical to preview render.

- Observability / Debugging
  - Confirm `metadata._prompt` and `metadata.requestMode` exist in responses for troubleshooting.

## Backward Compatibility

- Existing chat‑only model profiles keep working unchanged.
- Providers other than `openai-compatible` ignore `textTemplate` (capability is false by default), so behavior is unaffected.

