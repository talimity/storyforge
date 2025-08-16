# StoryForge Backend - Package Notes

## Architecture Cheat-Sheet (CRQS-lite)

### Structure

```
src/
  api/routers/*                         # tRPC glue only
  engine/*                              # PURE domain helpers (no I/O)
  inference/*                           # LLM providers, prompt-to-API-payload rendering
  library/<feature>/*.queries.ts        # read models
  library/<feature>/*.write.service.ts  # transactional writes
```

### Workflow (add a feature)

1. **DB** – Add tables/migrations in `packages/db/src/schema/*` and relations.
2. **Contracts** – Define Zod contracts in `packages/schemas/src/contracts/*`.
3. **Reads** – Add `*.queries.ts` functions that return UI/workflow-shaped data.
4. **Writes** – Add `*.write.service.ts` functions (one per use case) that wrap a transaction + invariants.
5. **Engine** – Keep logic pure; inject data via query helpers.
6. **API** – Thin tRPC procedures that validate I/O and call queries/services.

### Reads (Queries)

- **Goal:** Return exactly the shape a screen or pipeline step needs.
- Prefer `db.query.*` relation DSL; **drop to raw SQL** if it’s clearer (e.g., recursive CTE for timelines).
- **No `includeFoo` flags.** New shape → new query fn.
- **Batch-first:** accept arrays and use `IN (…)` to avoid N+1.
- **Tiny selectors:** factor common column/extras fragments to kill duplication.
- When a shape stabilizes (counts/aggregates), consider a **view** to encode the join once.

### Writes (Services)

- **One function per use case** (e.g., `advanceTurn`, `archiveChapter`).
- **Exactly one transaction** per call; enforce invariants inside.
- Create a service when:
  - multi-table write or state transition,
  - needs retries/events/background job,
  - “Rule of 3” call-site reuse.

### Context System

- **Loader (impure):** (in library) gathers scenario, participants, timeline window, templates, lorebooks.
- **Builder (pure):** (in engine) constructs a `GenerationContext` from the loader data according to a PromptSpec.
- Loader owns fetching strategy (window sizes, batching); Builder is purely deterministic.

### Guardrails

- **No repositories.** Reads = queries; writes = services.
- **Reads never open transactions.**
- **Engine code is pure.** Absolutely no `db.*` or network inside agents/builders.
- **Ports at boundaries:** LLM providers, filesystem/assets, timers, job runners.
  - LLM code goes in `inference/`
- **Naming reflects behavior:** `*.queries.ts`, `*.write.service.ts`, `context.loader.ts`, `context.builder.ts`.

### tRPC Procedures

- Validate inputs/outputs via schemas.
- Orchestrate calls only; **no business logic**.

### When in doubt

- If it **crosses a process/vendor boundary, wrap it.**
- If you’re about to add a boolean to a query, **make a new query.**
- If you feel like sharing write choreography, **make a service.**
- If the function can be pure, **keep it pure.**

## Web API

Web API is served on port 3001. The API is built with Fastify and tRPC and includes trpc-to-openapi to expose most tRPC procedures as RESTful endpoints.

A few functions (anything involving serving files, primarily) must use Fastify routes directly, but tRPC is used for most API interactions.

## LLM Inference Architecture

**Flow**: `GenerationContext` → `GenerationContextAdapter` → `ChatCompletionRequest` → `LLMProvider` → API payload

- **GenerationContext**: Narrative-aware sections (system/reference/history/task) + parameters + model
- **ChatCompletionRequest**: Standard `{messages: ChatMessage[], parameters, model}` - provider-agnostic
- **GenerationContextAdapter**: Converts narrative contexts to standardized chat messages
- **LLMProvider interface**: `generate()`, `generateStream()`, `listModels()`, `renderPrompt()`

**Providers**: OpenRouter, DeepSeek, Mock
