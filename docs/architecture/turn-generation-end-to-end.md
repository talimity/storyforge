# Turn Generation End-to-End Flow

This guide traces how a single turn is produced, starting from the player UI and ending at the inference provider.

1. **Player submits an intent**
   - The frontend collects the player’s input (intent kind, text, optional branch-from metadata) and calls `play.createIntent`.
   - The API router instantiates `IntentService.createAndStart`, which records the `pending` intent, resolves branching targets, and selects the appropriate intent executor.

2. **Intent executor drives the timeline service**
   - Executors (manual control, guided control, etc.) run as async generators yielding `IntentEvent`s.
   - Commands such as `generateTurn`, `insertTurn`, and `chooseActor` are invoked in sequence. `insertTurn` writes turns via `TimelineService.advanceTurn`, records intent effects, and moves the scenario anchor to the new leaf.
   - While `generateTurn` is running, a pending workflow is kicked off and the intent run manager streams events (`gen_start`, `gen_token`, `gen_finish`) back to subscribers so the UI can display draft feedback.

3. **Workflow runner prepares prompt context**
   - `generateTurn` uses `IntentContextBuilder` to assemble the `TurnGenCtx`: full timeline, character roster, current intent metadata, step inputs, and globals. This context satisfies the `TurnGenSources` contract.
   - The workflow runner (from `@storyforge/gentasks`) loads the configured turn-generation workflow, template, and model profile. It compiles the prompt template with the turn-generation source registry and renders chat messages under budget control.

4. **Inference adapter executes the request**
   - Using the model profile, the runner creates a provider adapter via `@storyforge/inference`. Capability overrides are applied and preflight checks verify assistant prefill requirements.
   - The adapter’s `completeStream` method performs the network call (streaming SSE, REST, etc.) and yields `ChatCompletionChunk`s. The runner emits `stream_delta` events as text arrives, aggregates them, applies output transforms, and captures outputs for reuse in later workflow steps.

5. **Workflow finishes and inserts the turn**
   - The workflow runner emits `step_finished` and `run_finished` events with final outputs. The intent command picks up the generated prose and calls `insertTurn`, which persists the `presentation` layer, attaches the intent effect, and updates the scenario’s anchor.
   - The intent run manager emits `effect_committed` and eventually `intent_finished`. The player UI reconciles by refetching the timeline slice; the new turn now appears at the anchor.

6. **Downstream observability**
   - Throughout the flow, the Generation Run Recorder listens to workflow events to store prompt snapshots, model metadata, and captured outputs. Intent progress endpoints expose the event stream, letting the UI display live draft status.

This chain ensures that UI inputs remain decoupled from provider specifics, templates render against typed contexts, and every mutation to the timeline is recorded with clear provenance.
