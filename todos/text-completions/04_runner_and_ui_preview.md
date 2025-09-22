# 04 — Runner Wiring & UI Template Preview

Goal: thread the model profile’s `textTemplate` into the request, and provide a minimal UI editor + preview that uses the shared Jinja renderer from `@storyforge/inference`.

## Runner

- File: `packages/gentasks/src/runner/types.ts`
  - Ensure `ModelProfileResolved` includes `textTemplate?: string | null` (see 01 doc).

- File: `packages/gentasks/src/runner/runner.ts`
  - When constructing the `ChatCompletionRequest`, include `textTemplate: profile.textTemplate ?? undefined`.

Snippet:

```ts
const request: ChatCompletionRequest = {
  model: profile.modelId,
  messages: transformedMessages,
  maxOutputTokens: step.maxOutputTokens || 8192,
  stop: step.stop,
  genParams: { ...profile.defaultGenParams, ...step.genParams },
  hints,
  signal,
  textTemplate: profile.textTemplate ?? undefined, // NEW
};
```

No other runner changes are required; the adapter chooses the path.

## Frontend UI

- Add a simple Jinja template editor for model profiles:
  - Inputs: `template` (textarea/editor), `messages` (read‑only example based on the profile’s task), `prefix` (toggle derived from whether the last message is an assistant continuation in the example; allow manual toggle for previewing).
  - Use `renderTextTemplate(template, { messages, prefix })` to update the preview.
  - Show a small variable reference: `messages` (array of `{ role, content }`), `prefix` (boolean).

## Acceptance Checklist

- Runner includes `textTemplate` on the request.
- UI can render previews that match adapter behavior (same helper).

