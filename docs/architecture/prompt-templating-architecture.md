# StoryForge Prompt Templating Architecture

## Purpose
This document explains how StoryForge models, validates, and renders prompt templates. It is intended to help contributors understand the mental framework behind templates, the contract they establish with task contexts, and the runtime pipeline that transforms author-authored templates into model-ready messages.

## System Overview
- **Templates** describe the shape of prompts: which messages appear, how content is sourced, and how sections are conditionally included.
- **Task kinds** define the data contract for templates, exposing named sources (DataRefs) and render-time context. Each task kind publishes its own source registry and allowed source list.
- **Compilation** converts authored templates into immutable artifacts with precompiled leaf functions, ensuring structural integrity before runtime.
- **Rendering** flows through layout preparation, slot execution, attachment injection, and post-processing under the governance of a budget manager.

The prompt system keeps authoring concerns, task-provided data, and runtime orchestration loosely coupled. Templates only know about abstract source names; tasks supply concrete data to satisfy those names.

## Template Model
Templates follow a versioned JSON schema stored in the database. Key constructs:
- **Layout nodes** describe the final conversation order. They can be literal messages, references to named **slots**, or declarative **anchors** used as injection markers. Layout nodes support optional headers and footers around slot content and can omit empty slots entirely.
- **Slots** are filled during rendering. Each slot has:
  - A **priority** (lower runs first) so high-importance content consumes the budget before optional sections.
  - An optional **condition** gate evaluated against the render context.
  - An optional **budget** ceiling layered under the global budget.
  - A **plan**: an ordered list of plan nodes that emit messages when executed.
- **Plan nodes** provide flow control:
  - `message` blocks output literal text or resolve a DataRef, optionally skipping empty interpolations or marking assistant prefixes.
  - `forEach` iterates over an array source with ordering, limits, optional separators, and nested plans. Loop iterations can prepend or append output and respect their own budgets.
  - `if` evaluates a condition and executes `then`/`else` branches accordingly.
  - `anchor` records a zero-width marker that downstream injections can target without emitting a message.
- **DataRefs** reference named sources defined by the task. They may include arguments (e.g., filters or slicing instructions). Templates also gain access to reserved helper sources like `$item`, `$index`, `$parent`, `$globals`, and `$ctx`, which expose loop state, globals, and the raw context without polluting the formal source registry.
- **Budgets** describe token ceilings. A global budget governs the overall render, and nested budgets can be applied per slot or plan node. Consumption uses a simple estimator (~4 chars per token) by default but is centralised so alternative estimators can be injected later.
- **Attachments** are optional lane specifications that describe default roles, templates, ordering, and reserved capacity for late-stage injections. Templates can omit attachments and rely on task-provided defaults.

## Authoring Contracts & Validation
Templates are authored against specific task kinds. The pipeline enforces several contracts when ingesting user-authored JSON:
1. **Schema validation** ensures shape correctness (version, layout/slot structure, plan grammar).
2. **Task binding** asserts the template’s declared task kind matches the expected one for the workflow where it will be used.
3. **Source linting** checks every DataRef against the allowed sources exported by the task (plus reserved helpers). This prevents templates from pulling data that the runtime will never provide.
4. **Structural guards** verify slot names are unique, layout nodes reference existing slots, anchors appear in valid locations, and prefix flags only appear on assistant messages.

Templates that pass validation are stored as raw JSON in the prompt template table. At render time they are rehydrated and revalidated before compilation, safeguarding against out-of-band edits.

## Compilation Pipeline
Compilation turns an untrusted template into an immutable artifact ready for repeated use:
1. **Parsing** applies the schema and source linting again (optionally narrowed to a task kind).
2. **Structure validation** rechecks slot/layout/anchor invariants as a final authoring safety net.
3. **Leaf compilation** rewrites every literal string with interpolation into a callable function that remembers whether it produced content in its last run. This enables features like `skipIfEmptyInterpolation` without re-parsing strings on every render.
4. **Deep freeze** recursively locks the compiled template to avoid accidental mutations while it is cached or shared across workflows.

Compilation can run as part of template creation/update flows (to provide author feedback) and whenever a template is loaded for execution (to shield the renderer from malformed data).

## Rendering Lifecycle
Rendering consumes a compiled template, a task context, a budget manager, and the task’s source registry. It proceeds through four coordinated stages:
1. **Layout preparation**
   - Literal layout messages and slot headers/footers are pre-rendered into prepared blocks.
   - Anchor nodes resolve to concrete keys so downstream injections can reference them.
   - The budget manager reserves a lane floor for layout work, ensuring structural instructions survive even when downstream slots consume most of the budget.
2. **Slot execution**
   - Slots execute in priority order, each under its optional budget scope.
   - Conditions are evaluated before any plan work; skipped slots record an empty buffer.
   - Plan nodes resolve DataRefs via the registry. For `forEach`, the engine extends the registry with loop frames, enabling `$item` and `$index` references. Nested loops push additional frames while preserving parent access via `$parent`.
   - Every emitted message decrements both the global budget and the slot’s node budget. The global manager also tracks per-lane floors that protect reserved capacity.
3. **Layout assembly**
   - The assembler walks the prepared layout, injecting slot buffers, headers, and footers in declared order.
   - Slot anchors are translated into global indices. Headers/footers consume the layout lane and release unused floor when skipped.
   - After assembly, neighbouring messages with the same role are squashed to reduce noisy role switching before sending to the inference adapter.
4. **Attachment injection**
   - Attachment requests are grouped by lane, sorted by lane order and individual priority, and executed with per-lane reservations.
   - Each request may provide an ordered list of targets. Targets include named anchors, anchor-relative offsets, or explicit `top`/`bottom` boundaries with optional deltas. The renderer evaluates targets in order and inserts the message at the first viable index.
   - Requests whose targets cannot be resolved are skipped; there is no implicit fallback.

The renderer returns an ordered array of chat completion messages. Calling code can then hand that array to whichever inference provider the workflow selected.

## Budget Management
The `DefaultBudgetManager` tracks:
- **Global ceiling**: a running total of consumed tokens and the template’s max tokens.
- **Node budgets**: a stack of scoped ceilings applied while executing a slot or plan node.
- **Lane floors**: minimum reservation pools for layout or attachment lanes. Non-lane work cannot consume reserved capacity, while lane work first draws from its floor and then from remaining global headroom.
- **Lane context**: a stack indicating which lane is currently consuming tokens so floors can decrement accurately.

The estimator defaults to four characters per token. Implementations can inject alternative estimators by providing a different `TokenEstimator` when constructing the budget manager.

## Attachments & Lanes
Attachments connect templates to late-stage injection lanes. Each lane definition describes:
- An identifier shared with injection requests.
- Optional default role and template used when a request does not provide one.
- Optional ordering key that controls when the lane executes relative to other lanes.
- Optional reserve/budget values that protect tokens for the lane before slot execution begins.
- Optional static payload merged into each request’s payload.

Tasks can define default lane configurations. Templates can override those defaults by supplying an `attachments` array or omit it entirely to inherit the task defaults.

## Injection Requests
Tasks, workflows, or third-party extensions raise `InjectionRequest` objects when they want to insert additional content after the template’s slots are rendered. Each request contains:
- A lane id that matches either the template’s attachments or the task defaults.
- Optional role/template overrides.
- Arbitrary payload merged into the leaf template scope.
- A priority used to break ties within a lane.
- One or more targets. Targets can be:
  - `at`: insert at an anchor, optionally choosing the first, last, or nth occurrence.
  - `offset`: insert relative to the most recent anchor occurrence.
  - `boundary`: insert using the top/bottom of the prompt plus an optional offset.

Requests list multiple targets to provide explicit fallback positions. The renderer evaluates them in order and skips the request completely if none resolve.

## Integration with Task Systems
Each task package (e.g., turn generation, chapter summarization, writing assistant) exports:
- A **context type** that spells out what data is provided at render time (turn history, character roster, workflow step outputs, globals, etc.).
- A **SourceSpec** describing named sources, accepted arguments, and returned shapes. These specs drive both compile-time linting and runtime type safety.
- A **source registry factory** that maps the spec to concrete resolver functions using the task context.
- A **list of allowed source names** to hand to template validation.

Because templates never reach into the raw context directly, swapping in a different task context only requires updating the registry and allowed sources. This separation also lets automation reuse the prompt engine outside workflows as long as it honours the same contract.

## Error Handling & Resilience
- **Authoring errors** (unknown sources, structural issues) raise dedicated validation exceptions so UI surfaces can present actionable feedback.
- **Runtime issues** (missing data, registry failures) prefer graceful degradation. Resolver exceptions are logged and treated as absent data, letting templates fall back on optional blocks or conditions.
- **Prefix misuse** is blocked during validation to avoid generating invalid chat payloads (only assistant messages may prefill content).
- **Budget exhaustion** truncates further output. Template authors should structure content so the most important pieces execute first via slot priorities and lane reservations.

## Design Principles & Extension Points
- **Task/Template decoupling** keeps templates portable and testable. To add a new task kind, define its SourceSpec and allowed sources, then templates can target it without renderer changes.
- **Multi-stage rendering** isolates layout preparation, slot execution, attachment injection, and post-processing, keeping each concern focusable and testable.
- **Reserved helper scopes** provide ergonomic access to loop items and globals without expanding every SourceSpec.
- **Runner-provided metadata** augments contexts before render; e.g., workflow runners attach `ctx.model` so templates can react to the active provider/model configuration without task builders wiring that data manually.
- **Versioned schema** allows iterative evolution of the template language; higher versions can introduce new node types or metadata while maintaining backward compatibility via parsing.
- **Pluggable budgets and registries** mean future work (e.g., accurate token estimators, dynamic source providers) can slot in without rewriting templates.

Keeping these boundaries clear ensures prompt authoring remains expressive while the runtime stays predictable and task-specific data remains the single source of truth.
