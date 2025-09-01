# Workflow Runner Architecture

## Overview

The workflow runner is a generative AI task execution engine that orchestrates multi-step content generation workflows. It provides the interface by which application features can generate content using LLMs for a particular task, without also having to interface with the prompt templating system or the inference providers directly.

The system is intended to enable generation patterns like multi-stage refinement (Draft → Refine), planning-based generation (Planner → Writer), and critique-based improvement (Generate → Critique → Revise), all while streaming progress events and supporting cancellation.

## Core Concepts

### Generative Tasks

A **generative task** (or "gentask") represents a specific type of content generation request that the application needs to fulfill. Each task kind defines:
- The shape of an input context object
  - This is the raw data object that the prompt template engine will use to render prompts
- The source registry
  - This defines how prompt templates can access data from the context object, including any arguments they can pass to filter or modify the data
- The task key, which is used to bind prompt templates and workflow steps to this task kind

Currently supported task kinds:
- `turn_generation` - Generate narrative turns in response to player intents
- `chapter_summarization` - Compress blocks of turns into summaries
- `writing_assistant` - Transform or extend user-provided text

### Workflows and Steps

A **workflow** is a sequence of steps that execute to fulfill a generative task. Each workflow is bound to exactly one task kind and contains one or more steps that execute sequentially.

Each **step** in a workflow:
- References a prompt template of the workflow's specified task kind
- Specifies a model profile for inference
- Defines generation parameters and constraints
- Captures outputs for use by subsequent steps
- Applies transformations to inputs or outputs

### Task Contexts and Source Registries

Each task kind defines a **context shape** containing all the data needed for generation. For example, turn generation contexts include turns, chapter summaries, characters, and the current player intent.

A **source registry** implements a way for prompt templates to access context data. Each task kind has its own registry that exposes data sources like `turns`, `characters`, or `stepOutput` (for accessing previous step results).

Registry handlers can accept arguments and can access the full context object to filter, compose, or transform data as needed.
- ie. the application needs only to hydrate a `turns` field; the handler can expose views like `turnsByCharacter(characterId)`, `latestTurns(limit)`, or even compose data from multiple fields (e.g. to interleave turns with the player intent input that created them).

## Architecture Components

### WorkflowRunner

The central orchestrator that executes workflows. Created via `makeWorkflowRunner()` with dependencies for:
- Loading prompt templates
- Loading model profiles
- Creating inference adapters
- Providing source registries
- Managing token budgets

The runner returns a `RunHandle` immediately upon starting a workflow. This handle provides methods for:
- Async iteration over progress events
- Awaiting the final result
- Cancelling the execution
- Capturing state snapshots

### RunStore

An in-memory store that manages the lifecycle of workflow runs. For each run, it maintains:
- Event buffer for streaming progress
- Step outputs and responses
- Abort signals for cancellation
- Result promises for completion

The store allows workflows to run independently of clients. If a client disconnects, they can be reattached to the run upon reconnection. When subscribing to a run store, the client receives all buffered events to reconstruct state.

### Event System

The runner emits granular events throughout execution:
- `run_started` / `run_finished` - Workflow lifecycle
- `step_started` / `step_finished` - Step boundaries
- `prompt_rendered` - Template output
- `stream_delta` - Token streaming
- `step_captured` - Final output capture
- `run_error` / `run_cancelled` - Error states

### Dependencies and Adapters

The runner expects injected dependencies for:
- **Storage layer** - Templates and model profiles are loaded via async functions
- **Inference layer** - Inference adapters are created via factory functions
- **Token estimation** - Budget managers handle token counting according to whatever tokenizer logic is appropriate for the models in use

## Workflow Execution Flow

### Step Execution Pipeline

Each step follows a deterministic execution pipeline:
1. **Template Loading** - Load and compile the prompt template for the step
2. **Context Preparation** - Merge base context with outputs from previous steps
3. **Prompt Rendering** - Generate chat messages using the template engine and budget
4. **Input Transformation** - Apply regex or trim transforms to the rendered messages
5. **Hint Derivation** - Detect assistant prefill requirements from message structure
6. **Model Resolution** - Load model profile and instantiate provider adapter
7. **Inference Request** - Stream tokens from the inference provider
8. **Output Transformation** - Apply transforms to the generated text
9. **Output Capture** - Extract and store specified outputs for subsequent steps

### Output Capture and Step Chaining

Steps can capture outputs in multiple formats:
- `assistantText` - Raw generated text
- `jsonParsed` - Parsed JSON with optional path extraction

Captured outputs become available to subsequent steps' prompt templates via the `stepOutput` source. Examples of step chaining:
- Using a planner's JSON output to guide a writer
- Passing a critic's analysis to a revision step
- Accumulating context across multiple generation stages

### Transformations

The system supports transformations at two points:
- **Input transforms** - Modify rendered messages before inference
- **Output transforms** - Process generated text before capture

Transform types include:
- `trim` - Remove whitespace from start/end/both
- `regex` - Pattern-based find and replace

## Task Implementation

### Defining a Task Kind

Each task kind requires three components:

1. **Context Type** - The shape of input data:
```typescript
type TurnGenCtx = {
  turns: TurnCtxDTO[];
  chapterSummaries: ChapterSummCtxDTO[];
  characters: CharacterCtxDTO[];
  currentIntent: { description: string; constraint?: string };
  stepInputs: Record<string, unknown>;
  globals: TurnGenGlobals;
};
```

2. **Source Specification** - Available data sources and their arguments:
```typescript
type TurnGenSources = {
  turns: {
    args: { order?: "asc" | "desc"; limit?: number };
    out: TurnCtxDTO[];
  };
  stepOutput: { 
    args: { key: string }; 
    out: unknown 
  };
  // ... more sources
};
```

3. **Source Registry** - Implements handlers for each data source:
```typescript
const turnGenRegistry = makeRegistry({
  turns: (ref, ctx) => {
    const { order, limit } = ref.args ?? {};
    // Process and return turns
  },
  stepOutput: (ref, ctx) => ctx.stepInputs[ref.args.key],
  // ... more handlers
});
```

### Registry Extension

The runner automatically extends base registries with a `stepInputs` field to enable step chaining. This happens transparently - task implementations only need to ensure their context includes a `stepInputs` field and a `stepOutput` handler.

### Template Binding

Prompt templates are generic over task kinds and their source registries. This allows the DSL to check source references at compile time. Templates are compiled at runtime to validate the DSL, and if an `allowedSources` list is provided to `compileTemplate<TKind, TSource>()`, source references can be checked at runtime as well.

## Integration Points

### Prompt Rendering Integration

The workflow runner integrates with the prompt rendering system through:
- **Template compilation** - Templates are compiled with source validation
- **Budget management** - Token budgets constrain template rendering
- **Context injection** - Task contexts flow through the registry to templates
- **Message generation** - Rendered messages feed directly to inference

### Inference Provider Integration

Integration with inference providers happens through:
- **Model profiles** - Encapsulate provider config, model ID, and capability overrides
- **Provider adapters** - Abstract provider-specific APIs into a common interface
- **Generation parameters** - Step-level params overlay profile defaults
- **Streaming support** - Async iteration over token chunks with event emission
- **Cancellation** - AbortSignal propagation through the entire stack

The constructs the `ChatCompletionRequest` expected by provider adapters using the rendered messages, model profile, and step parameters. It will also set any provider-specific hints. Adapters will raise an error if a workflow step requests capabilities the model or provider does not support.

### Application Integration

Applications integrate with the workflow runner by:
1. **Defining task kinds** with appropriate context shapes
2. **Creating workflows** that reference templates and models
3. **Providing dependencies** for template/model loading and adapter creation
4. **Starting runs** with prepared context data
5. **Consuming events** for progress display and state management
6. **Handling results** for persistence or further processing

The runner remains agnostic to application concerns like turn management, intent orchestration, or UI state; it focuses solely on executing the defined workflows and emitting structured events.

## Events and Cancellation

### Event Types and Flow

The event system emits structured events to signal progress and state changes:
- **Lifecycle events** track overall run progress
- **Step events** mark execution boundaries
- **Streaming events** deliver real-time generation
- **Capture events** signal output availability
- **Error events** provide failure diagnostics

Subscribers can be detached and reattached to runs and will receive all events emitted since the start of the run.

### Cancellation and Cleanup

Cancellation is cooperative and immediate:
- AbortController signals propagate to all async operations
- Inference requests terminate gracefully
- Event queue stops accepting new events from runner
- Subscribers receive a final `run_cancelled` event
- Result promises reject with cancellation errors

The RunStore maintains run state until explicitly cleared.
