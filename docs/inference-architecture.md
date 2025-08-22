# Inference Providers & Model Configuration – Backend & Frontend Design

## 1) Goals & Non‑Goals

**Goals**

* Support multiple inference providers (DeepSeek, OpenRouter, OpenAI‑Compatible, etc) with per‑provider API keys and capability declarations.
* Let users create **Model Profiles** per provider (optionally multiple instances per provider) and override capabilities per model.
* Offer an optional **Model Search** interface (provider‑specific) while always allowing manual model ID entry.
* Provide a **standard chat request/response** interface so the rest of the app is provider‑agnostic.
* Enable story generation, summarization, and writing assistant tasks, including multi‑step workflows that can bind different models per step.

**Non‑Goals**

* Basically rebuilding all of openrouter
* Perfect abstraction over the wide variety of inference provider and model quirks; as long as the hacks are hidden in the adapters it doesn't matter

**Deferred Goals**

* Support for multimodal chat completions requests (image inputs)
* Support for image or TTS models outside of chat completions, as a completely separate type of inference request
* Lorebook/world info handling; just leave space for it and abstract away the lore matching implementation
* Tools; we know we probably want it eventually but have no idea what it will look like or how characters should use them

---

## 2) Key Concepts & Abstractions

### 2.1 Provider Config

* **Why**: You may need multiple *instances* of the same provider (e.g., several OpenAI‑Compatible backends: local vLLM, cloud vLLM, llama.cpp). Even traditional providers (OpenAI, DeepSeek, OpenRouter) may be used with separate accounts or billing contexts.
* **Entity**: `ProviderConfig`

    * `id`
    * `providerKind` ∈ {`deepseek`, `openrouter`, `openai_compatible`, etc}
    * `displayName` (user‑chosen label like “OpenAI (work)”, “Local vLLM:5000”)
    * `auth`: { optional `apiKey`, optional `extraHeaders`: Record<string,string> }
    * `baseUrl` (required for `openai_compatible`, optional for others)
    * `capabilities` optional, json, Partial<TextInferenceCapabilities> (only used for openai_compatible since its adapter is generic; non-generic providers capabilities are hard-coded in the adapter's actual implementation)

**Notes**

* Built‑in providers can have prefilled defaults for `baseUrl`.
* Multiple instances are allowed for all providers for consistency.
* Eventually, `openai_compatible` will probably also require storing 'quirks' lists and generation parameter mapping overrides (`topP` -> `top_p`) for additional flexibility. Not worth speccing this out right now since OpenRouter is enough to get the core stuff working.

### 2.2 Model Profile

* **Why**: Users pick a model (string ID) and may override provider defaults.
* **Entity**: `ModelProfile`

    * `id`
    * `providerId` (fk → `ProviderConfig.id`)
    * `name` (user label, e.g., "Qwen2.5‑Coder‑32B via local ollama)"
    * `modelId` (string, e.g., `gpt-4o-mini`, `deepseek-chat`, `qwen2.5:latest`, `google/gemma-2-9b-it` for OpenRouter)
    * `capabilities_overrides` optional, json, Partial<TextInferenceCapabilities>

**Lifecycle**

* Created by user from **Models** library screen.
* User can search for `modelId`. Some providers (OpenRouter) have an API for this and our adapter can expose a search method. Otherwise we may hard-code a catalog (as with DeepSeek). Manual model ID entry should always be possible.

### 2.3 Capabilities Model

Represent a minimal superset of features we need to gate or adapt.

```ts
/**
 * Defines the text inference capabilities of a model or inference provider.
 */
export type TextInferenceCapabilities = {
  /** Whether tokens can be streamed as they are generated. */
  streaming: boolean;
  /** Whether the assistant message can be prefilled to guide generation. */
  assistantPrefill: boolean;
  /** Whether logprobs can be requested for generated tokens. */
  logprobs: boolean;
  /** Whether tool use is supported. */
  tools: boolean;

  // TODO: FIM, guided generation, `n` for parallel generations, etc. - for now YAGNI
};
```

**Notes**

* Built-in providers will have Capabilities hard-coded (according to whatever the built-in adapter implements).
* OpenAI-compatible's adapter will be more flexible, so its capabilities are declared in the schema and toggleable in the UI.
* Model Profiles can **override** any of these when a specific model differs (e.g. OpenRouter's API interface can do everything, but some of its models won't return logprobs).

### 2.4 Standard Chat Request/Response

The application talks only in this shape.

```ts
export type ChatCompletionsMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string; // multimodal can be a future extension
};

// Tool use interface very much not settled as it will be a much later feature; don't implement right away, just leave space
export type ToolDef = {
  name: string;
  description?: string;
  jsonSchema?: object; // for structured args if provider supports it
};

export type ToolCall = {
  name: string;
  arguments: any; // json
  id?: string;    // to correlate
};

export type ChatCompletionsRequest = {
  messages: ChatCompletionsMessage[];
  tools?: ToolDef[];
  toolChoice?: 'auto' | { name: string } | 'none';
  responseFormat?: 'text' | { type: 'json_schema', schema: object } | 'json';
  temperature?: number; topP?: number; topK?: number; maxTokens?: number;
  presencePenalty?: number; frequencyPenalty?: number; stop?: string[]; seed?: number;
  // Hints
  usePrefill: boolean; // some providers automatically prefill the assistant response if the final message is an assistant message, but some need a hint (and some do not support it)
};

export type ChatCompletionsChunk = {
  delta?: string;                     // streaming text delta
  toolCallDelta?: Partial<ToolCall>;  // streaming tool-call
  metadata?: Record<string, unknown>; // metadata to merge
};

export type ChatCompletionsResponse = {
  message: ChatCompletionsMessage;
  toolCalls?: ToolCall[];
  metadata?: Record<string, unknown>; // `_prompt` key contains the exact rendered prompt as sent to the API
}
```

**Rule**: If an unsupported feature is requested (e.g., `tools` on a model without tool calling), the request should fail before any HTTP request is made. Either some routing layer, or the provider adapter, should raise the preflight error.

### 2.5 Provider Adapter Interface

```ts
export interface ProviderAdapter {
  kind: ProviderKind;
  // Introspection
  defaultCapabilities(): TextInferenceCapabilities;
  supportedParams(): Array<keyof TextInferenceGenParams>; // e.g., temperature, topP, maxTokens

  // Optional
  searchModels?(query: string, auth: Auth, baseUrl?: string): Promise<Array<{id: string, label?: string, tags?: string[]}>>;

  // Core
  complete(
    config: ProviderConfig,
    modelId: string,
    request: ChatCompletionsRequest,
  ): Promise<ChatCompletionsResponse>;
  
  completeStream(
    config: ProviderConfig,
    modelId: string,
    request: ChatCompletionsRequest,
  ): AsyncIterable<ChatCompletionsChunk, ChatCompletionsResponse>

  // Returns the exact JSON payload the adapter would send for a given completion request, for troubleshooting and testing workflows
  renderPrompt(
    config: ProviderConfig,
    modelId: string,
    request: ChatCompletionsRequest,
  ): string
}
```

**Notes**

* `completeStream` implementations should accumulate chunks internally as they yield them, so that they can construct a `ChatCompletionsResponse` and return that.
* Each provider implements its own quirks as a 'post-processing' step. That means merging duplicated consecutive roles (user->user->assistant), stripping `system` role messages and adding a `systemPrompt` if the API requires a top-level system prompt, etc.
* We might eventually add a way to let generic `openai_compatible` provider dynamically apply certain quirks transformations, based on enabled quirks. This is a specific behavior of the generic openai_compatible adapater, not the built-in adapters for specific providers.

## 3) Persistence Model

**Tables**

* `provider_configs`

    * `id TEXT PRIMARY KEY`
    * `provider_kind TEXT NOT NULL`         // ∈ {`openrouter`, `deepseek`, `openai_compatible`}
    * `display_name TEXT NOT NULL`
    * `auth TEXT NOT NULL`             // {apiKey, orgId?, extraHeaders?}
    * `base_url TEXT`
    * `capabilities TEXT`              // Capabilities (openai_compatible)
    * `params TEXT`                    // GenParamsMap (openai_compatible)
    * `quirks TEXT`                    // Quirks (openai_compatible)
    * timestamps

* `model_profiles`

    * `id TEXT PRIMARY KEY`
    * `provider_instance_id TEXT NOT NULL`
    * `name TEXT NOT NULL`
    * `model_id TEXT NOT NULL`
    * `capability_overrides TEXT`      // Partial<TextInferenceCapabilities>
    * timestamps + FK

* `llm_tasks` (bind app features → prompt/workflow)

    * `id TEXT PRIMARY KEY`
    * `task_kind TEXT NOT NULL`           // e.g., 'chapter_summarization', 'writing_assistant', 'turn_generation'
    * `display_name TEXT`
    * `workflow_id TEXT`                  // fk → workflow.id
    * `scope TEXT NOT NULL`               // 'default' | characterId | participantId
    * timestamps

* `workflows`

    * `id TEXT PRIMARY KEY`
    * `name TEXT NOT NULL`
    * `description TEXT`
    * `version INTEGER NOT NULL`
    * `nodes TEXT NOT NULL`               // JSON array of Step (see 4.1)
    * `is_builtin INTEGER NOT NULL`
    * timestamps

* `prompt_templates`

    * `id TEXT PRIMARY KEY`
    * `name TEXT NOT NULL`
    * `template TEXT NOT NULL`       // handlebars or some simple DSL
    * `inputs_schema TEXT`           // JSON schema for inputs... maybe used for *additional* inputs, on top of ones specified by the LLM task type
    * `metadata TEXT`                // { author, description, tags, version }
    * timestamps

**Notes**

* ProviderConfig capabilities/params/quirks are nullable in the database because they only apply to "openai_compatible"-type providers. Use a check if SQLite has them to enforce that.
* Might be best to type all of the JSON fields as `Record<string, unknown>` at the drizzle level and force consumers to `safeParse` with zod before using, maybe combined with a `version` column for workflows.

---

## 4) Workflows, Prompts, and Context

### 4.1 Workflow Model (multi‑step, model‑per‑step)

A *Workflow* is an ordered list of Steps.

```ts
export type Step = {
  id: string;
  name: string; // e.g., Draft, Refine, Critique, Tool‑use
  modelProfileId: string; // which model/profile to use
  promptTemplateId: string; // which template to render
  truncationRules?: {
    maxContextTokens?: number; // budget for context
    includePastTurns?: number; // N past turns
    includePastChapterSummaries?: number; // summaries for past N chapters
  };
  // transformations might need to be extracted since they might often be reused across workflows and steps to handle model quirks or apply user style preferences
  transformations: {
    applyTo: "input" | "output";
    regex?: { pattern: RegExp; substitution: string; };
    trim?: "start" | "end" | "both";
  }[];
  outputs: {
    key: string; // e.g., 'draft', 'summary', 'edits'
    capture: 'assistantText' | 'jsonParsed' | 'toolResults';
  }[];
};
```

* **Context vs Prompt**: *Context* is *loaded* by the feature executing an LLM task (ie., a chapter's turn history for "summarization" task, textarea input for "writing assistant" task, scenario timeline for "turn generation" task). Then the prompt is *rendered*, using inputs + `PromptTemplate` (text instructions + slots/macros for replacements), and with transformations. The feature loads all of the `inputs` that the pure renderer uses to fill the template.
    - Different renderer per feature type -- summarization renderer probably looks quite different from the writing assistant renderer.
* How is lorebook/world info handled?
    * Just another input, presumably; feature provides the renderer with a loader function, which given an input (such as the text of recent turns) does regex matching or vector similarity to return lore entries that should be injected. Renderer doesn't care and just calls the loader with the turns it has decided to insert.

### 4.2 Prompt Templates

* Stored separately from workflows, can be used across them, reusable across workflows.
* Renderer: Handlebars or basic tag syntax with functions (e.g., `{{trim chapterText 12000}}`). Needs to be able to handle conditionals.

### 4.3 Example Built‑In Workflows

* **Chapter Summarization**: 1 step → `modelProfileId = default_summarizer` → `promptTemplate = summarize_v1`.
* **Writing Assistant** (inline): 1 step → `default_assistant_model` → `promptTemplate = assistant_actions_v1`.
* **Turn Generation (Draft → Refine)**: 2 steps → Draft with fast model; Refine with higher‑quality model. Step 2 consumes `outputs.draft` as input, but also receives the normal Turn Generation inputs as well

## 5) Validation & Capability Negotiation

* Combine `ProviderConfig.capabilities` with `ModelProfile.capabilityOverrides` → `effectiveCaps`.
* Check `ChatCompletionRequest` features vs `effectiveCaps`. Error with:
    * Missing capability (e.g., tool calling not supported);
    * Unsupported param (e.g., `topK` not mapped to any provider param);
    * Incompatible options (e.g., prefix hint set but prefix is not supported by model or provider)

## 6) Provider Search Interface

### 6.1 Adapter Contract

* `searchModels?(query, auth, baseUrl)` returns `{id, label?}[]`.
* **OpenRouter**: implement real search per OpenRouter API
* **DeepSeek**: return a filtered list from a hardcoded catalog (e.g., `deepseek-chat`, `deepseek-reasoner`).
* **OpenAI‑Compatible**: optional `/models` if server supports; otherwise none.

### 6.2 UI Behavior

* Autocomplete dropdown sources from `searchModels` when available; otherwise expose a local list or “No search available”.
* Always show a **Manual Entry** field; if user types a value not in search results, accept it.

## 7) Frontend UX Spec

### 7.1 Settings → Providers (ProviderConfigs)

* **List**: cards per config instance (name, kind, base URL, quick test button).

* **Add Provider** (form):

    1. Pick provider kind
    2. Name & Base URL (if compatible)
    3. API key + extras dictionary
    4. For `openai-compatible`
       a. Capabilities checkbox field
       b. Generation parameter mapping
       c. Quirks checkbox field
    6. Test Connection (ping / small completion)

* **Instance Detail**: edit API key, headers; capabilities matrix; params; delete;

### 7.2 Settings → Models (ModelProfiles)

* **List**: table with `name`, `provider`, `modelId`, key capabilities badges, notes.
* **Create/Edit** drawer:

    * Select **Provider** (dropdown)
    * **Model**: search/autocomplete + manual entry
    * **Capability Overrides** (toggle switches)

### 7.3 Settings → Tasks & Workflows

* **Tasks** tab: show global (Chapter Summarization, Writing Assistant, Turn Generation). For each, pick a **Default Workflow**.
    * Then in different areas of the application users can set overrides, which we use task `scope` to denote. ie:
        * A `"turn_generation"` task binding with `scope: "character"` and `characterId: "xyz"` is used instead of the default whenever a Player Intent ('Story Constraint: Character A trips and falls') has resulted in an Intent Effect for that character (runs the turn generation task for that character, using the story timeline and intent's text as inputs).

* **Workflows** tab: visual editor (vertical steps, but maybe eventually React Flow if it gets sophisticated enough):
    * Step card: name, **Model Profile** selector, **Prompt Template** selector, **Prompt Config** (responseFormat, prefix, FIM), **Truncation Rules**.
    * Add/Remove/Reorder steps.
    * Step I/O: name output layers (e.g., `draft`) and specify how subsequent steps consume them.
        * We store all layers for all past turns in the DB, so we can even include past turns' `draft` outputs as an input to the this `draft` step, as a sort of few-shot learning

### 7.4 Prompt Templates

* Library view; inputs editor (JSON form from the LLM Tasks's base schema + whatever additional inputs are defined for that template) and rendered prompt preview.

### 7.5 Test Console

* Pick a **Model Profile** → freeform prompt or a selected template with inputs; see streaming output, token usage stats, and emitted tool calls.

## 8) Error Handling

* **Workflow Validation Errors**: Zod can immediately inform when a workflow is not valid at design time.
* **Workflow Step-to-Prompt Template Incompatibilities**: If the selected prompt template can't be applied to that workflow type, or the template has additionalInputs that are not provided by the workflow node, raise error at design time.
* **Capability Mismatch**: If a workflow node has assigned a model which (either the model or the provider API that offers it) cannot meet its requirements, raise an error.
    * This can happen beyond design time, if capabilities are edit after the model has already been assigned to workflows. So we must evaluate this at generation time too.
* **Provider error**: At generation time, we need to handle different error types.
    * Rate limited (temporary; retry-after?)
    * Quota limited ('permanent', until the user adds more credits or increases the key's quota limit)
    * Overloaded (temporary, but probably don't auto-retry)
    * Safety (don't auto-retry, user has to adjust the prompt content)
    * Others??

Provider errors would require a standardized provider error handling interface if we want different retry behaviors and such which is going to be a PITA. Probably more practical to just immediately abort the workflow and bubble up any provider errors for now.
