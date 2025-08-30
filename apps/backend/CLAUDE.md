# StoryForge Backend – Architecture Cheat Sheet

## Layering (one-liners)

* **services/** - **impure application layer**. Transactional writes (UoW), screen/workflow-shaped reads, service orchestration, SQL/CTEs, file parsing, etc.
* **api/** - **transport**. tRPC procedures only: I/O validation, OpenAPI metadata, error mapping; no business logic.
* **@storyforge/inference** package - **ports/adapters** to external LLM providers.
* **engine/** - pure domain core; invariants, rules, and planners; no db/network/filesystem.
  * Migrate domain logic here from services as it stabilizes.
  * Should be side-effect free.
  * Gradually moving to separate package (see `packages/prompt-rendering`)

```
apps/backend/src/
  engine/                        # PURE domain logic (no side effects)
    invariants/                  # Checks that enforce correctness of story engine
    ...
  services/                      # IMPURE application layer (DB, files, tx)
    character/
      utils/                     # Feature-local helpers
      character.service.ts       # Unit-of-Work pattern transactional writes
      character.queries.ts       # Read models shaped for specific UI screens
    scenario/
      ...
    turn/
      ...
    ...
  api/
    routers/
      characters.ts
      play.ts
      chat-import.ts
      ...
```

Reusable cross-feature helpers go in **`packages/utils`**.

## Golden rules

### Purity boundary

* **engine/** stays pure. Input/Output are plain data (`Result` or simple objects).
    - Inject data, never fetch in engine. Engine functions accept either plain DTOs or a loaders interface of callbacks (provided by a `service`) for on-demand reads.
* **services/** perform all side effects. Services call engine invariants or orchestrate multi-step processes, plans or workflows.

### Transactions

* **Exactly one transaction per public service call** (UoW).
* Pass `outerTx?: SqliteTransaction` through to all inner calls that need it.
* Any read that must see uncommitted writes must accept/use `outerTx`.

### Reads vs Writes

* `*.queries.ts` → **reads only**. No transactions. Return objects **shaped for one screen/workflow**. Use SQL/CTEs freely; avoid N+1 by design.
* `*.service.ts` → **writes**. One UoW, calls engine invariants, does DB/file ops, emits domain errors.

### Errors
* **Engine** returns typed failures via `Result<T, E>` for domain rule violations (e.g., `ChapterProgressionInvalid`, `MissingPresentationLayer`).
* **Services** throw...
    - `EngineError(code)` for failures returned by the domain layer.
    - `ServiceError("InvalidInput" | "NotFound" | "Conflict" | "Forbidden", detail)` for errors that originate within the service layer itself.
* **api/** maps errors to TRPC/HTTP (e.g., `engine-error-to-trpc.ts`)

### Contracts-first
* Define Zod I/O in `packages/schemas`.
* Routers import those schemas; all routes include OpenAPI meta to generate REST endpoints.
* Queries/services should exactly satisfy the API contract shape.
    - Result transformation should ideally happen inside of the `*.queries.ts`. Don't create a separate module for just mapping or transformations.

### SQL policy
* Use Drizzle's SQL-like query builder API for most queries.
* Use Drizzle's relational query builder API when you need to express relations/joins as it will handle data mapping for you.
  * For situations where the relational API is too limited or cumbersome, use the SQL-like API with manual joins and mapping, or raw SQL/CTEs for particularly complex queries.
  * This is the v2 API, which uses object literals for `where` clauses:
```ts
  await db.query.scenarioParticipants.findMany({
    columns: { id: true, role: true },
    where: { scenarioId }, // note: NOT `where(eq(p.scenarioId, scenarioId))`, that is the old api
    with: {
      character: {
        columns: { id: true, name: true },
      },
    },
    orderBy: (p) => [p.orderIndex],
  });
```
* Tailor `*.queries.ts` SQL to the specific screen/workflow; avoid generic "get full entity" queries; avoid turning queries modules into repositories.
* Keep `*.service.ts` SQL simple and focused on the UoW; no fancy read shaping there.
* Avoid executing individual SQL statements within loops; prefer joins or batched queries when possible.

## Classification: where does code go?
**Decision table**

| Question                                                           | YES →                             | NO →                                        |
|--------------------------------------------------------------------|-----------------------------------|---------------------------------------------|
| Does it mutate state / need a transaction?                         | `services/<feature>/*.service.ts` | next                                        |
| Is it a domain rule/logic whose correctness the engine depends on? | `engine/**` or separate package   | next                                        |
| Is it a UI/workflow-shaped read?                                   | `services/<feature>/*.queries.ts` | next                                        |
| Is it a helper used only by one feature?                           | `services/<feature>/utils/`       | Put it in `packages/utils` if cross-feature |

## Naming & file conventions
* Feature folder names are **nouns** (`turn`, `scenario`, `chat-import`).
* Public APIs are **verbs**:
    * Services: `advanceTurn`, `deleteTurn`, `importChatAsScenario`
    * Queries: `getTimelineWindow`, `analyzeChat`

## Service skeleton (writes)
```ts
// apps/backend/src/services/feature/feature.service.ts
export class FeatureService {
  constructor(private db: SqliteDatabase) {}

  async doSomething(args: Args, outerTx?: SqliteTransaction) {
    const work = async (tx: SqliteTransaction) => {
      // Load, then validate with engine
      const loaders = {/* ... */};
      const check = combine(
        engineInvariantA(...),
        engineInvariantB(...),
      );
      if (!check.ok) throw new EngineError(check.error);

      // Mutations (one tx)
      // ...

      return result;
    };
    return outerTx ? work(outerTx) : this.db.transaction(work);
  }
}
```

**Rules**
* Validate via **engine** before mutating.
    * If it's simple input validation, do it straight in the Zod contract.
* Throw `EngineError` for domain rule failures; `ServiceError` for product/input policy.
* Accept `outerTx` and pass it down.

## Query skeleton (reads)
```ts
// apps/backend/src/services/feature/feature.queries.ts
export async function getScreenData(db: SqliteDatabase, input: Input) {
  // strictly read-only; no tx
  const rows = await db.all<...>(sql`WITH ... SELECT ...`);
  return shapeForScreen(rows);
}
```

**Rules**
* No writes. No transactions.
* Shape exactly for the consumer screen/workflow.
* Don't call `queries` from services, because they will escape the transaction.

## Router skeleton
```ts
// apps/backend/src/api/routers/feature.ts
export const featureRouter = router({
  list: publicProcedure
    .meta({ openapi: { method: "GET", path: "/api/feature", tags: ["feature"], summary: "List feature items" }})
    .input(z.void())
    .output(listResponseSchema)
    .query(async ({ ctx }) => getScreenData(ctx.db, {})),

  doThing: publicProcedure
    .meta({ openapi: { method: "POST", path: "/api/feature/do-thing", tags: ["feature"], summary: "Do the thing" }})
    .input(doThingInputSchema)
    .output(doThingOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new FeatureService(ctx.db);
      return await svc.doSomething(input);
      // service/engine errors caught and mapped to trpc by error middleware
    }),
});
```

## Vertical slice implementation on-rails
1. **Add contracts** in `packages/schemas`.
2. **Create router** with OpenAPI meta in `api/routers/*`.
3. **Implement**:
    * **Query** in `services/<feature>/*.queries.ts` (if read/preview), or
    * **Service** in `services/<feature>/*.service.ts` (if write/UoW).
      Use/extend **engine** only if you add or change domain rules.
4. **(Optional)** Add `services/<feature>/utils/*` for feature-local helpers.
5. **Frontend** consumes the query/service contract directly. See the frontend CLAUDE.md for its own architecture guidelines.
