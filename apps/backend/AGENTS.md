# StoryForge Backend – Architecture Cheat Sheet

## Layering

* **services/** - **impure application layer**. Transactional writes (UoW), screen/workflow-shaped reads, service orchestration, SQL/CTEs, file parsing, etc.
* **api/** - **transport**. tRPC procedures only: I/O validation, OpenAPI metadata, error mapping; no business logic.
* **@storyforge/inference** package - **ports/adapters** to external LLM providers.

```
apps/backend/src/
  api/
    routers/                     # tRPC/REST API by feature
      characters.ts
      characters.ts
      play.ts
      chat-import.ts
      ...
  services/                      # Application layer by domain
    character/
      utils/                     # Feature-local helpers
      character.service.ts       # Unit-of-Work pattern transactional writes
      character.queries.ts       # Read models shaped for specific UI screens
    scenario/
      ...
    turn/
      ...
    ...
```

Reusable cross-feature helpers go in **`packages/utils`**.

## Golden rules

### Transactions

* **Exactly one transaction per public service call** (UoW).
* Pass `outerTx?: SqliteTransaction` through to all inner calls that need it.
* Any read that must see uncommitted writes must accept/use `outerTx`.

### Reads vs Writes

* `*.queries.ts` → **reads only**. No transactions. Return objects **shaped for one screen/workflow**. Use SQL/CTEs freely; avoid N+1 by design.
* `*.service.ts` → **writes**. One UoW, checks invariants, does DB/file ops, emits domain errors.

### Errors
* **Services** throw `ServiceError("InvalidInput" | "NotFound" | "Conflict" | "Forbidden", detail)` for errors that originate within the service layer itself.
* **api/** maps errors to TRPC/HTTP (e.g., `service-error-to-trpc.ts`)

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
    where: { scenarioId }, // note: NOT `where(eq(p.scenarioId, scenarioId))`; that is old Drizzle v1 relational querybuilder API
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

## Naming & file conventions
* Feature folder names are **nouns** (`turn`, `scenario`, `chat-import`).
* Public APIs are **verbs**:
    * Services: `advanceTurn`, `deleteTurn`, `importChatAsScenario`
    * Queries: `getTimelineWindow`, `analyzeChat`

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
* No writes.
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
      // service errors caught and mapped to trpc by error middleware
    }),
});
```

## Vertical slice implementation on-rails
1. **Add contracts** in `packages/schemas`.
2. **Create router** with OpenAPI meta in `api/routers/*`.
3. **Implement**:
    * **Query** in `services/<feature>/*.queries.ts` (if read/preview), or
    * **Service** in `services/<feature>/*.service.ts` (if write/UoW).
4. **(Optional)** Add `services/<feature>/utils/*` for feature-local helpers.
5. **Frontend** consumes the query/service contract directly. See the frontend AGENTS.md for its own architecture guidelines.

## Defining API contracts
Take special care to mind the distinction between optional/nullable/nullish when defining Zod contracts.

- `nullable()`: Adds ` | null` to the type.
  - Use for fields returned from the API to a client. Makes it explicit when a field is missing.
  - Use for optional fields when accepting inputs for a *create* operation. Requires clients to provide a value or explicitly request `null`.
- `nullish()`: Adds ` | null | undefined` to the type.
  - Use for optional fields when accepting inputs for an *update* operation. Allows clients to leave the field unchanged (`undefined`) or clear it (`null`).
- `optional()`: Adds ` | undefined` to the type.
  - Generally, don't use this for entity fields, since the database driver never returns `undefined`. You can use it for computed or derived fields.
  - You can use this for inputs to GET requests, where `null` doesn't make sense. Example: search filters, pagination, etc.
  - You can use `.partial()` on a "create" schema to derive an "update" schema.
