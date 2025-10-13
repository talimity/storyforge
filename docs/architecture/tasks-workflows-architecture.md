# StoryForge Tasks & Workflow Architecture

## Purpose
This document explains how StoryForge models generative tasks and orchestrates multi-step workflows. It focuses on the `@storyforge/gentasks` package and its runtime runner, describing how task contexts, source registries, prompt templates, and inference calls fit together.

## Core Concepts
- **Task kind**: a named contract (e.g., `turn_generation`, `chapter_summarization`, `writing_assistant`) that declares the data a prompt may consume and the outputs callers expect.
- **Task context**: the runtime payload handed to the workflow runner. Contexts are typed per task kind and populate the sources that prompt templates reference.
- **Source registry**: a map of DataRef handlers for a task kind. It is the only mechanism templates use to read data from the context, keeping templates decoupled from raw objects.
- **Workflow**: a versioned recipe composed of ordered steps. Each step names a prompt template, model profile, optional transforms, and output captures. Workflows are typed to a single task kind.
- **Workflow runner**: the runtime engine that validates workflows, renders prompts, streams inference responses, captures outputs, and emits telemetry events.

Together these layers let StoryForge assemble complex prompt workflows while preserving strong boundaries between authoring, data preparation, and inference execution.

## Task Definitions
Each task file under `packages/gentasks/src/tasks/` defines four ingredients:
1. **Context type** (e.g., `TurnGenCtx`, `ChapterSummCtx`, `WritingAssistantCtx`). Contexts gather the data that prompt templates need—turn history, character rosters, user text, workflow step inputs, globals, etc.
2. **Source specification** (`TurnGenSources`, `ChapterSummSources`, etc.). A SourceSpec maps a source name to an argument shape and an output type. This drives both template linting and runtime TypeScript safety.
3. **Registry factory** (`turnGenRegistry`, `chapterSummarizationRegistry`, `writingAssistRegistry`). Registries implement the Spec by supplying actual resolver functions that read from the context. For example, `turns` can filter, slice, or reverse chronology; `stepOutput` retrieves previously captured data.
4. **Allowed source name list** (`TURN_GEN_SOURCE_NAMES`, …). These are exported to prompt template validation so templates cannot reference data the task never provides.

Tasks own the truth about what data is available to prompts. Introducing a new task kind is as simple as describing a new context/spec/registry trio and hooking it into the workflow runner manager.

## Workflow Definition Model
Workflows are plain JSON/TypeScript structures validated by `genWorkflowSchema`:
- **Metadata**: `id`, `name`, optional description, `task` kind, and version (`1`).
- **Steps**: each `GenStep` specifies `modelProfileId`, `promptTemplateId`, optional `name`, request-time overrides (`genParams`, `maxOutputTokens`, `maxContextTokens`, `stop` tokens), optional text transforms, and a list of output capture directives.
- **Transforms**: simple trim or regex rewrites that can apply to rendered input messages or generated output text. They operate as a low-tech post-processing layer without requiring template edits.
- **Output captures**: instructions for persisting data for later steps. Options include raw assistant text or parsed JSON (with optional dotted paths).

Validation happens both at workflow creation and at run start, ensuring workflows remain compatible as type definitions evolve.

## Execution Lifecycle
The workflow runner (`makeWorkflowRunner`) executes steps sequentially. High-level flow:
1. **Preparation**
   - Workflow JSON is validated.
   - A run entry is created in the in-memory `RunStore`, yielding an AbortController, event queue, and result promise. The run is attached to any parent AbortSignal for cancellation propagation.
   - The base task context is wrapped by `ensureExtendedContext`, guaranteeing a shared `stepOutputs` map exists even if the caller omitted one.
2. **Step loop**
   - For each step the runner emits `step_started` and builds the working context by layering the accumulated `stepOutputs` (captured outputs from prior steps).
   - The step’s prompt template is loaded and compiled with the task’s allowed source list. Compilation re-runs prompt validation and produces immutable leaf functions.
   - The prompt is rendered via `render`, using a budget manager seeded with `maxContextTokens`. The `createExtendedRegistry` wrapper simply forwards to the task registry, but ensures type compatibility with the augmented context.
   - The runner records `prompt_rendered` and optionally `input_transformed` events if transforms mutate the messages.
   - Hints (currently assistant prefill requirements) are derived from the final message sequence.
   - The step’s model profile is loaded; provider config and optional capability overrides feed into the inference adapter.
   - `step_prompt` is emitted, noting the profile, model, and hints.
   - The adapter’s streaming completion API is invoked. As delta chunks arrive, they aggregate text and emit `stream_delta` events. On stream completion a final response object is assembled (filling content from the aggregate if the provider omits it).
   - Output transforms run on the final text. Output capture rules parse or record values into the `captured` map, with `step_captured` emitted when non-empty.
   - Step responses and captured outputs are stored in the run state and exposed to later steps through the `stepOutput` source. A `step_finished` event closes out the iteration.
3. **Finalization**
   - After the last step the runner emits `run_finished`, finalizes the run with accumulated outputs, and resolves the result promise.
   - Errors trigger `run_error` and reject the result promise; cancellations trigger `run_cancelled` and abort the inference request via the stored AbortController.

Throughout execution, event consumers (backend services, front-end devtools, diagnostics recorders) can subscribe to the run’s AsyncBroadcast to receive telemetry in real time. Stored snapshots make it easy to inspect a run’s state at any moment.

## Step Context Sharing
Steps communicate through the `stepOutputs` object:
- Output capture keys populate `stepOutputs` for subsequent steps, enabling chained workflows (e.g., a reasoning draft feeding into a prose rewrite).
- The prompt templating system accesses these via the runtime-provided `stepOutput` source added by the extended registry.
- `createExtendedRegistry` keeps DataRef resolution agnostic to the extended shape, so task-specific handlers do not need to know whether they are reading initial context or derived data.

## Error Handling & Cancellation
- **Schema errors**: thrown before execution begins so callers can surface actionable validation messages.
- **Template issues**: compilation reuses prompt templating guards; failures bubble as user-facing validation errors.
- **Inference failures**: captured as `run_error` with the provider’s message; the run result rejects and subscribers receive completion events.
- **Cancellation**: the run store aborts inference, marks the run as cancelled, and rejects the result promise with a cancellation error.
- **Cleanup**: a reaper prunes finished runs after a TTL to prevent unbounded memory growth.

## Integration with the Rest of the System
- The backend’s `WorkflowRunnerManager` builds a singleton runner per task kind, wiring it with database loaders for templates and model profiles, and injecting provider adapters from the inference package.
- The intent engine passes scenario contexts and branch metadata into the `turn_generation` runner, relying on generated events to keep UI and telemetry up to date.
- Generation diagnostics (Chapter summaries, intent replay) observe workflow events to reconstruct prompts, responses, and metadata for inspection.

## Design Principles & Extension Points
- **Task modularity**: new domains can be added by defining a context/spec/registry trio and registering them with the runner manager.
- **Template/Workflow reuse**: prompt templates stay agnostic to step orchestration. A template can be reused in different workflows or ad-hoc runs as long as the context contract is met.
- **Streaming-first**: runs emit prompt and delta events immediately, enabling live UI updates and telemetry recording.
- **Deterministic orchestration**: steps execute strictly in order with shared state controlled through captured outputs, making workflows easy to reason about.
- **Observability hooks**: rich event history plus snapshots give debuggability without invasive logging.
- **Adapter abstraction**: the runner only depends on the `ProviderAdapter` interface, so new providers integrate by implementing that contract and providing capability overrides via model profiles.

Future enhancements—conditional branching between steps, richer transform pipelines, or pluggable budget estimators—can build on this architecture without disrupting existing workflows.
