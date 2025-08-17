# StoryForge Backend - Package Notes

## Architecture Cheat-Sheet

### Structure

```
src/
  api/routers/*                # tRPC glue only (I/O validation, call queries/services)
  engine/**                    # PURE domain logic + invariants (no DB, no network)
  inference/**                 # LLM providers, prompt rendering, tools (ports)
  library/<feature>/
    *.queries.ts               # read models (UI/workflow-shaped, read-only)
    *.service.ts               # transactional use-cases (units of work, writes, orchestration)
  context/
    context.loader.ts          # impure data gathering (DB, files, etc.)
    context.builder.ts         # pure assembly to GenerationContext
```

### Workflow (adding a feature)

1. **DB** — Add schema + indexes in `packages/db`.
2. **Contracts** — Define Zod I/O in `packages/schemas`.
3. **Reads** — Implement `<feature>.queries.ts` returning exactly the shapes screens/pipelines need.
4. **Writes** — Implement `<feature>.service.ts` (one function per use-case) that opens **one** transaction and enforces invariants.
5. **Engine** — Put business rules/invariants here; they’re pure and injected with data via loaders.
6. **API** — Keep procedures thin; map `EngineError` → TRPC once, globally.

### Reads (Queries)

- Return **screen/pipeline-shaped** objects; no “includeFoo” flags. New shape → new function.
- Prefer Drizzle relation DSL for queries, but drop to **SQL/CTE** for complex cases instead of fighting the ORM.
  - New Drizzle relational query builder uses object literals ( `{ where: { col: val } }` ) instead of `eq()`, etc.
- **Batch-first**: accept arrays, use `IN (…)` to avoid N+1.
- For relational query builder, factor out repeated column/extras **selectors** for reuse.
- When a shape stabilizes (counts/aggregates), consider a **DB view**.

### Writes (Services / UoW)

* **One function per use-case** (e.g., `advanceTurn`, `applyIntent`, `archiveChapter`).
* **Exactly one transaction** per call.
* Call **engine invariants** (pure) to validate; on failure, **throw `EngineError(code)`**.
* Keep tx **short**: never call LLMs or remote APIs inside; produce outputs first, then persist.
* Make writes **idempotent** (unique keys like `(intent_id, sequence)`).
* Emit events/notifications **after commit** (outbox later if needed).

#### Composing Services

- If your unit of work is large, you can compose smaller services together.
- Higher-level orchestrators (e.g., `IntentService.applyIntent`) open **one outer tx** and pass it down to smaller services.
- **Do not nest transactions.**

```ts
export class TimelineService {
  constructor(private db) {}
  async advanceTurn(args, outerTx?: Transaction) {
    const work = async (tx: Transaction) => {
      // Validate invariants
      const validation = canAppendTurnToChapter(args.chapterId, args.turnId);
      if (!validation.ok) {
        throw new EngineError(validation.error);
      }
      // Perform operations
      const turn = await createTurn(tx, args);
      await appendTurnToChapter(tx, args.chapterId, turn.id);
      await updateLastTurn(tx, args.scenarioId, turn.id);
      return turn;
    };
    return outerTx ? work(outerTx) : this.db.transaction(work);
  }
}

export class IntentService {
  constructor(private db) {}

  async applyIntent(args) {
    return this.db.transaction(async (tx) => {
      const intent = await getPendingIntents(tx, args.scenarioId);
      await LoreService.updateLore(intent.loreUpdates, tx);
      await ParticipantService.updateCharacterStates(intent.characterUpdates, tx);
      await TimelineService.advanceTurn({ args }, tx);
      await completeIntent(tx, intent.id);
    });
  }
}
```

### Engine

- Keep **all** domain rules in `engine/invariants` (e.g., `canCreateTurn`, `canAppendTurnToChapter`).
- Return `Result`, **services** convert failures to `EngineError(code)`.

### EngineError handling

- `engine-error-to-trpc.ts` maps domain errors to TRPC errors with appropriate HTTP status codes.
  - `instanceof EngineError` → map `code` to HTTP/TRPC status.
  -Unknown → 500.
- Routers don’t catch—just return service/query results.

### Context System

- **Loader (impure):** gather scenario, participants, last X turns, summaries, templates, lorebooks.
- **Builder (pure):** assemble `GenerationContext` from loader data + PromptSpec.
- Loader decides window sizes/batching; Builder is deterministic/pure.

### Guardrails

- **No repositories.** Reads = queries; Writes = services; 
- **Reads never open transactions.**
- **Engine code is pure** (no DB, no network).
- **Invariants are pure** and injected with data from loaders

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
