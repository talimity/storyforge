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
  * `rollDice`, `searchLore`, `completeTodo`, `updateTodos`

---

## 2) Key Concepts & Abstractions

### 2.1 Provider Config

* **Why**: You may need multiple *instances* of the same provider (e.g., several OpenAI‑Compatible backends: local vLLM, cloud vLLM, llama.cpp). Even traditional providers (OpenAI, DeepSeek, OpenRouter) may be used with separate accounts or billing contexts.
* **Entity**: `ProviderConfig`

    * `id`
    * `providerKind` ∈ {`deepseek`, `openrouter`, `openai-compatible`, etc}
    * `displayName` (user‑chosen label like “OpenAI (work)”, “Local vLLM:5000”)
    * `auth`: { optional `apiKey`, optional `extraHeaders`: Record<string,string> }
    * `baseUrl` (required for `openai-compatible`, optional for others)
    * `capabilities` optional, json, Partial<TextInferenceCapabilities> (only used for openai-compatible since its adapter is generic; non-generic providers capabilities are hard-coded in the adapter's actual implementation)

**Notes**

* Built‑in providers can have prefilled defaults for `baseUrl`.
* Multiple instances are allowed for all providers for consistency.
* Eventually, `openai-compatible` will probably also require storing 'quirks' lists and generation parameter mapping overrides (`topP` -> `top_p`) for additional flexibility. Not worth speccing this out right now since OpenRouter is enough to get the core stuff working.

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
  assistantPrefill: "implicit" | "explicit" | "unsupported";
  /** Whether tool use is supported. */
  tools: boolean;

  // TODO: FIM, guided generation, `n` for parallel generations, etc. - for now YAGNI
};

// GenParams are treated as optional, whereas capabilities are required.
export interface TextInferenceGenParams {
  temperature?: number;
  topP?: number;
  // ...
}

// Hints guide provider behavior and help reject incompatble requests early. We
// use hints when capability needs cannot be inferred from the prompt alone.
export type ChatCompletionRequestHints = {
  assistantPrefill?: "auto" | "require" | "forbid";
};

export type PreflightResult =
  | { ok: true; prefillMode: "prefill" | "no-prefill" }
  | { ok: false; reason: string };
```

**Notes**

* Built-in providers will have Capabilities hard-coded (according to whatever the built-in adapter implements).
* OpenAI-compatible's adapter will be more flexible, so its capabilities are declared in the schema and toggleable in the UI.
* Model Profiles can **override** any of these when a specific model differs (e.g. OpenRouter's API interface can do everything, but some of its models won't return logprobs).
* If a feature is not REQUIRED for a generative task workflow's step to succeed (ie. top K sampling), it should not be modeled as a capability. Only things that are absolutely required for the request to succeed (streaming, tools, prefill) should be modeled as capabilities.
  * TextInferenceGenParams can be used to model optional parameters like `topK`, `topP`, `temperature`, etc.
  * Logprobs are not modeled as a capability because it tends to be a quirky feature that does not work consistently across providers and models even when they claim to support it. All features that want to use logprobs need to degrade gracefully if logprobs are not available (at the request level, or even individual tokens).

### 2.4 Standard Chat Request/Response

The application talks only in this shape.

See the `packages/inference/src/types.ts` file for the full definitions.

```ts
export type ChatCompletionMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string; // multimodal can be a future extension
};

// Tools not modeled or implemented in v1, but they will eventually be needed

export type ChatCompletionFinishReason =
  | "stop"
  | "length"
  | "tool_use"
  | "content_filter"
  | "other";

export type ChatCompletionRequest = {
  messages: ChatCompletionMessage[];
  tools?: ToolDef[];
  toolChoice?: 'auto' | { name: string } | 'none';
  responseFormat?: 'text' | { type: 'json_schema', schema: object } | 'json';
  temperature?: number; topP?: number; topK?: number; maxTokens?: number;
  presencePenalty?: number; frequencyPenalty?: number; stop?: string[]; seed?: number;
  // Hints
  usePrefill: boolean; // some providers automatically prefill the assistant response if the final message is an assistant message, but some need a hint (and some do not support it)
};

export type ChatCompletionChunk = {
  delta?: { role, content, /* ... */ }      // streaming text delta
  metadata?: Record<string, unknown>; // metadata to merge
};

export type ChatCompletionResponse = {
  message: ChatCompletionMessage;
  finishReason: ChatCompletionFinishReason;
  metadata?: Record<string, unknown>; // `_prompt` key contains the exact rendered prompt as sent to the API
}
```

**Rule**: If an unsupported feature is requested (e.g., `tools` on a model without tool calling), the request should fail before any HTTP request is made. Either some routing layer, or the provider adapter, should raise the preflight error.

### 2.5 Provider Adapter Interface

```ts
export abstract class ProviderAdapter {
  abstract readonly kind: string;

  protected constructor(
    protected auth: ProviderAuth,
    protected baseUrl?: string
  ) {}
  
  // Introspection
  abstract defaultCapabilities(): TextInferenceCapabilities;
  abstract supportedParams(): Array<keyof TextInferenceGenParams>;

  // Optional
  abstract searchModels?(query: string): Promise<Array<{id: string, label?: string, tags?: string[]}>>;

  // Core
  abstract complete(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse>;
  abstract completeStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<ChatCompletionChunk, ChatCompletionResponse>;
  // Returns the exact JSON payload the adapter would send for a given completion request, for troubleshooting and testing workflows
  abstract renderPrompt(request: ChatCompletionRequest): string;
  
  protected preflightCheck(
    request: ChatCompletionRequest
  ): PreflightResult {}
  
  protected getHeaders(): Record<string, string> {}
}
```

### 2.6 Prompt Templates

The prompt templating and rendering system is handled by a separate package (`prompt-rendering`) and is not part of the provider architecture. Given a generative task's context (inputs) and a template it returns `ChatCompletionMessage[]` that the provider adapter can send to the API.

**Notes**

* `completeStream` implementations should accumulate chunks internally as they yield them, so that they can construct a `ChatCompletionResponse` and return that.
* Each provider implements its own quirks as a 'post-processing' step. That means merging duplicated consecutive roles (user->user->assistant), stripping `system` role messages and adding a `systemPrompt` if the API requires a top-level system prompt, etc.
* We might eventually add a way to let generic `openai-compatible` provider dynamically apply certain quirks transformations, based on enabled quirks. This is a specific behavior of the generic openai-compatible adapater, not the built-in adapters for specific providers.

## 3) Persistence Model

**Tables**

* `provider_configs`
    * `id TEXT PRIMARY KEY`
    * `provider_kind TEXT NOT NULL`         // ∈ {`openrouter`, `deepseek`, `openai-compatible`}
    * `display_name TEXT NOT NULL`
    * `auth TEXT NOT NULL`             // {apiKey, orgId?, extraHeaders?}
    * `base_url TEXT`
    * `capabilities TEXT`              // Capabilities (openai-compatible)
    * `params TEXT`                    // GenParamsMap (openai-compatible)
    * `quirks TEXT`                    // Quirks (openai-compatible)
    * timestamps

* `model_profiles`
    * `id TEXT PRIMARY KEY`
    * `provider_instance_id TEXT NOT NULL`
    * `name TEXT NOT NULL`
    * `model_id TEXT NOT NULL`
    * `capability_overrides TEXT`      // Partial<TextInferenceCapabilities>
    * timestamps + FK

* `gentasks` (generative task workflows bound to a particular task kind)
    * `id TEXT PRIMARY KEY`
    * `kind TEXT NOT NULL`           // e.g., 'chapter_summarization', 'writing_assistant', 'turn_generation'
    * `name TEXT NOT NULL`
    * `description TEXT`
    * `version INTEGER NOT NULL`
    * `steps TEXT NOT NULL`               // JSON array of Step (see 4.1)
    * `is_builtin INTEGER NOT NULL`
    * timestamps

* `gentask_bindings` (bind app features → gentasks, with optional scope for overrides)
    * `id TEXT PRIMARY KEY`
    * `display_name TEXT`
    * `gentask_id TEXT`                  // fk → gentask.id
    * `scope TEXT NOT NULL`               // 'default' | scenario | character | participant
    * timestamps

* `prompt_templates`
    * See [prompt-rendering](./prompt-template-engine-specification.md) for details

**Notes**

* ProviderConfig capabilities/params/quirks are nullable in the database because they only apply to "openai-compatible"-type providers. Use a check if SQLite has them to enforce that.
* Prompt templates and generative tasks are typed as `Record<string, unknown>` in the DB since they are JSON blobs. They will have a `version` field that indicates the schema version, so we can migrate them if needed.
  * Consumers must always validate them with Zod before use, because DB schema migrations will not update the stored JSON blobs. We will keep each version of the Zod schema around so old versions can still be validated and migrated in the application code.

---

## 4) Generative Task Workflows, Prompt Templates, and Context

### 4.1 Workflow Model (multi‑step, model‑per‑step)

A *Generative Task Workflow* (gentask) is an ordered list of Steps. Gentasks have a task kind (e.g., "turn_generation", "chapter_summarization", "writing_assistant") that determines the base schema of inputs (task context) that all steps receive.

The application uses a *gentask binding* to bind a particular feature (e.g., "turn generation for character X") to a gentask. The binding can have a `scope` that allows overriding the default gentask for that feature in certain contexts (e.g., a specific character or participant).

The *Task* defines the *base schema* of inputs (task context) that all workflows for that task will receive. Each Step can consume any subset of those inputs, plus outputs from previous steps in the same workflow.

```ts
export type GenTaskStep = {
  id: string;
  name: string; // e.g., Draft, Refine, Critique, Tool‑use
  modelProfileId: string; // which model/profile to use
  promptTemplateId: string; // which template to render
  genParams?: Partial<TextInferenceGenParams>; // optional overrides to the model's default params for this step (ie. to increase temperature for a creative step)
  globalMaxTokens?: number; // if set, sets the template's global token budget to this value
  // (transformations might need to be extracted, since they'll likely often be reused across workflows and steps to handle model quirks or apply user style preferences)
  transformations: {
    applyTo: "input" | "output";
    regex?: { pattern: RegExp; substitution: string; };
    trim?: "start" | "end" | "both";
  }[];
  outputs: {
    key: string; // used for both the TurnContent layer key and as the `stepOutputs` key, allowing subsequent steps' prompt templates to consume it
    capture: 'assistantText' | 'jsonParsed' | 'toolResults';
  }[];
};
```

* **Context vs Prompt**:
    * *GenTaskCtx* is *loaded* by the feature executing an LLM task (ie., a chapter's turn history for "summarization" task, textarea input for "writing assistant" task, scenario timeline for "turn generation" task).
      * Prompt templates are pure, so ALL data must be loaded up front. For lore info, this may mean running a lore matching step (either regex or possibly embedding-based) to find relevant lore entries and include them in the context.
    * `makeRegistry<K extends TaskKind>(handlers: Record<string, SourceHandler<K>>): SourceRegistry<K>` in `prompt-rendering` package knows how to extract the right fields from the task context for a given task kind, so that prompt templates can declare what inputs they need and get them from the task context.
    * Source registry handlers can take parameters, such as `start` and `end` indices so that a template can include arbitrary slices of a long text input (possibly multiple different slices, to format recent vs older turns differently).

### 4.2 Generative Task Scopes
*Gentask scopes* are hierarchical:
1. `default` (no scope) is the global default for that task kind.
2. `scenario` scope overrides the default for all characters in that scenario.
3. `character` scope overrides the scenario and default for a specific character.
4. `participant` scope overrides all scopes for a specific participant within a scenario.

When executing a task, the application looks for the most specific binding that matches the context (e.g., if generating a turn for character X in scenario Y, it first looks for a `participant` binding for that participant, then a `character` binding for character X, then a `scenario` binding for scenario Y, and finally falls back to the `default` binding).

The default bindings can be changed, but can't be deleted. Scoped bindings can be created and deleted freely, but only one binding per (task kind, scope) pair is allowed.

### 4.3 Prompt Templates

* Handled by `prompt-rendering` package as a separate concern. Accepts a `PromptTemplate` and a `GenTaskCtx` object and returns `ChatCompletionMessage[]`, but has no knowledge of workflows, models, capabilities, or providers.
* See `docs/prompt-template-engine-specification.md` for the full DSL and behavior spec.

### 4.4 Example Workflows

* **Chapter Summarization**: 1 step → `modelProfileId = default_summarizer` → `promptTemplate = summarize_v1`.
* **Writing Assistant** (inline): 1 step → `default_assistant_model` → `promptTemplate = assistant_actions_v1`.
* **Turn Generation (Draft → Refine)**: 2 steps → Draft with fast model; Refine with higher‑quality model. Step 2 consumes `outputs.draft` as input, but also receives the normal Turn Generation inputs as well

## 5) Validation & Capability Negotiation

* Combine `ProviderConfig.capabilities` with `ModelProfile.capabilityOverrides` → `effectiveCaps`.
* Adapters check `ChatCompletionRequest` features and hints vs `effectiveCaps` in a preflight step before making any HTTP requests.
* Adapters raise an error on anything that would either cause the request to fail, or have a high chance of producing unsatisfactory model output.
    * Missing capability (e.g., tool calling not supported);
    * Incompatible options (e.g., prefill hint set but prefill is not supported by model or provider)
* Adapters do NOT raise an error for missing or unmappable generation parameters (e.g., `topK`, `presencePenalty`); generation params' effects are often subtle and subjective, so we don't block requests on them.
* If a generation parameter being dropped would cause a significant change in the task's behavior or result, then it should be modeled as a capability instead of a generation parameter.

## 6) Provider Search Interface

### 6.1 Adapter Contract

* `searchModels?(query, auth, baseUrl)` returns `{id, label?}[]`.
* **OpenRouter**: implement real search per OpenRouter API
* **OpenAI‑Compatible**: optional `/models` if server supports; otherwise none.
* Providers without a search API: either return a hard-coded list (if it would not cause maintenance burden) or just an empty array and let the user look up model IDs themselves.

### 6.2 UI Behavior

* Autocomplete dropdown sources from `searchModels` when available
* Model ID autocomplete cannot be the only way to enter a model ID; always allow manual entry

## 7) Frontend UX

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
    5. Test Connection (ping / small completion)

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
