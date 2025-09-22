# 01 — Types, Schemas, and DB Migration

Goal: extend types/schemas to model text completions and store per‑profile templates; adjust defaults and keep existing constraints intact.

## Changes

1) `@storyforge/inference` types and schema

- File: `packages/inference/src/types.ts`
  - Add `textCompletions: boolean` to `TextInferenceCapabilities`.
  - Add `textTemplate?: string` to `ChatCompletionRequest`.

Illustrative diff:

```ts
// in TextInferenceCapabilities
export type TextInferenceCapabilities = {
  streaming: boolean;
  assistantPrefill: "implicit" | "explicit" | "unsupported";
  tools: boolean;
  fim: boolean;
  textCompletions: boolean; // NEW
};

// in ChatCompletionRequest
export interface ChatCompletionRequest {
  messages: ChatCompletionMessage[];
  model: string;
  maxOutputTokens: number;
  stop: string[];
  genParams?: TextInferenceGenParams;
  hints?: ChatCompletionRequestHints;
  signal?: AbortSignal;
  textTemplate?: string; // NEW
}
```

- File: `packages/inference/src/schemas.ts`
  - Extend `textInferenceCapabilitiesSchema` with the new field.

```ts
export const textInferenceCapabilitiesSchema = z.object({
  streaming: z.boolean(),
  assistantPrefill: z.enum(["implicit", "explicit", "unsupported"]),
  tools: z.boolean(),
  fim: z.boolean(),
  textCompletions: z.boolean(),
});
```

2) Provider defaults / factory

- File: `packages/inference/src/provider-factory.ts`
  - Update `getDefaultCapabilities`:
    - `openrouter`: `{ textCompletions: false }`
    - `deepseek`: `{ textCompletions: false }`
    - `openai-compatible`: `{ textCompletions: true }` (can be overridden by DB `capabilities`).
    - `mock`: `{ textCompletions: false }` (we can simulate later if useful).

3) Model profile storage (DB + contracts)

- DB: `packages/db/src/schema/model-profiles.ts`
  - Add a nullable `textTemplate` field to the table.

```ts
export const modelProfiles = sqliteTable("model_profiles", {
  // ...existing fields
  textTemplate: text("text_template"), // NEW: nullable
});
```

- Migration (Drizzle SQL)
  - File: `packages/db/src/migrations/xxxx_text-template-on-model-profiles.sql`

```sql
ALTER TABLE `model_profiles` ADD COLUMN `text_template` text;
```

- Contracts: `packages/contracts/src/schemas/provider.ts`
  - Extend `modelProfileSchema`, `createModelProfileSchema`, and `updateModelProfileSchema` with `textTemplate: z.string().nullable()`.

```ts
export const modelProfileSchema = z.object({
  // ...existing
  textTemplate: z.string().nullable(),
});

export const createModelProfileSchema = z.object({
  // ...existing
  textTemplate: z.string().nullable(),
});

export const updateModelProfileSchema = createModelProfileSchema.partial();
```

4) Runner’s resolved profile type

- File: `packages/gentasks/src/runner/types.ts`
  - Add optional `textTemplate?: string | null` to `ModelProfileResolved`.

```ts
export type ModelProfileResolved = {
  // ...existing
  textTemplate?: string | null; // NEW
};
```

## Notes on the Provider Capabilities Constraint

The existing DB constraint ensures `capabilities` JSON is set only for `openai-compatible` kinds. We keep this unchanged. `textCompletions` is provided (when needed) via that JSON; other providers don’t expose capabilities in DB and will use adapter defaults.

## Acceptance Checklist

- Types compile after adding the new fields.
- Contracts compile and reflect `textTemplate` in model profile APIs.
- Migration applies cleanly and is idempotent locally.
- `getDefaultCapabilities` returns the new fields for each provider kind.
