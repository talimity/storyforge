# Intent System — Implementation Plan (Turn Generation)

## Goals

* Persist **intents** and their **effects**.
* Orchestrate multi-effect intents (e.g., Direct Control = player turn + generated reply).
* Start and supervise **turn_generation** workflows using the existing runner.
* Stream **RunnerEvent**s to the client and persist results.
* Clean seams between API, orchestration, runner, and DB.

---

## New/Updated Files

```
apps/backend/src/api/routers/play.ts            // implement createIntent, intentProgress, intentResult
apps/backend/src/services/intent/intent-orchestrator.ts
apps/backend/src/services/intent/intent-supervisor.ts
apps/backend/src/services/intent/context-builder.ts
apps/backend/src/services/intent/binding-resolver.ts
apps/backend/src/services/runner/runner-hub.ts

packages/db/src/schema/intents.ts               // drizzle schema for intents + intent_effects
packages/db/src/schema/index.ts                 // export the new tables

packages/gentasks/src/runner/run-store.ts       // expose getResultPromise()
packages/gentasks/src/runner/runner.ts          // inject store + add attach(runId)
```

---

## Database (Drizzle + SQLite)

### Schema

```ts
// packages/db/src/schema/intents.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const intents = sqliteTable("intents", {
  id: text("id").primaryKey(),
  scenarioId: text("scenario_id").notNull(),
  kind: text("kind").notNull().$type<"direct_control" | "story_constraint">(),
  status: text("status").notNull().$type<"pending" | "finished" | "failed" | "cancelled">(),
  inputs: text("inputs").notNull().$type<Record<string, unknown>>(),
  workflowId: text("workflow_id").notNull(), // FK
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// packages/db/src/schema/intent-effects.ts

// One row per applicable effect (preserves provenance + multi-step)
export const intentEffects = sqliteTable("intent_effects", {
  id: text("id").primaryKey(),
  intentId: text("intent_id").notNull(),
  index: integer("index_").notNull(), // 0-based effect order
  kind: text("kind").notNull(), // 'insert_turn' | 'generate_turn' | ...
  status: text("status").notNull(), // 'applied' | 'failed'
  payloadJson: text("payload_json").notNull(), // authorParticipantId, layer, etc.
  turnId: text("turn_id"), // filled when applied
  appliedAt: integer("applied_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// packages/db/src/relations.ts
// (adapt to drizzle v2 relational api)
export const intentsRelations = relations(intents, ({ many }) => ({
  effects: many(intentEffects, { relationName: "intentEffects" }),
}));
export const intentEffectsRelations = relations(intentEffects, ({ one }) => ({
  intent: one(intents, {
    fields: [intentEffects.intentId],
    references: [intents.id],
    relationName: "intentEffects",
  }),
}));
```

### Partial Unique Index

Use the drizzle `uniqueIndex` syntax (refer to `turns` db schema for reference)

```sql
-- enforce one pending intent per scenario
CREATE UNIQUE INDEX intents_unique_pending_per_scenario
ON intents (scenario_id)
WHERE status = 'pending';
```

---

## Types

```ts
// apps/backend/src/services/intent/types.ts
export type IntentKind = // infer from DB
export type IntentStatus = // infer

export type EffectKind = // infer from DB
export type EffectStatus = "planned" | "applied" | "failed";

export type CreateIntentDirectControl = {
  kind: "direct_control";
  scenarioId: string;
  authorParticipantId: string; // player's selected character (who speaks now)
  playerText: string;
};

export type CreateIntentStoryConstraint = {
  kind: "story_constraint";
  scenarioId: string;
  chapterId: string;
  description: string;
  constraint?: string;
};

export type CreateIntentArgs = CreateIntentDirectControl | CreateIntentStoryConstraint;

export type PlannedEffect = {
  index: number;
  kind: EffectKind;
  payload: Record<string, unknown>;
};

export type TurnGenFinal = {
  presentationText?: string; // stable capture key from workflow
  [k: string]: unknown;
};
```

---

## Runner Changes

### `RunStore` — expose result promise

```ts
// packages/gentasks/src/runner/run-store.ts
// ...
export class RunStore {
  // existing code...
  getResultPromise(id: RunId) {
    return this.runs.get(id)?.resultPromise;
  }
}
```

### `makeWorkflowRunner` — injectable store + attach

```ts
// packages/gentasks/src/runner/runner.ts
export function makeWorkflowRunner<K extends TaskKind>(
  deps: RunnerDeps<K>,
  opts?: { store?: RunStore }
): WorkflowRunner<K> & { attach(runId: RunId): RunHandle | undefined } {
  const store = opts?.store ?? new RunStore();

  // ... existing startRun() using this store ...

  function attach(runId: RunId): RunHandle | undefined {
    if (!store.has(runId)) return undefined;
    const result = store.getResultPromise(runId);
    return {
      id: runId,
      events: () => store.events(runId),
      result: result ?? Promise.reject(new Error("No resultPromise for run")),
      cancel: () => store.cancel(runId),
      snapshot: () => {
        const snap = store.snapshot(runId);
        if (!snap) throw new Error(`Run ${runId} not found`);
        return snap;
      },
    };
  }

  return { startRun, attach };
}
```

---

## Runner Hub

```ts
// apps/backend/src/services/runner/runner-hub.ts
import { RunStore } from "@storyforge/gentasks/src/runner/run-store";
import { makeWorkflowRunner } from "@storyforge/gentasks/src/runner/runner";
import { turnGenRegistry } from "@storyforge/gentasks/src/tasks/turn-generation";
import type { RunnerDeps } from "@storyforge/gentasks/src/runner/types";

export class RunnerHub {
  private static _i: RunnerHub | null = null;
  static instance(): RunnerHub {
    return (this._i ??= new RunnerHub());
  }

  private store = new RunStore();
  private turnRunner = makeWorkflowRunner<"turn_generation">(
    this.makeTurnDeps(),
    { store: this.store }
  );

  startTurnRun(...args: Parameters<typeof this.turnRunner.startRun>) {
    return this.turnRunner.startRun(...args);
  }
  attachTurnRun(runId: string) {
    return this.turnRunner.attach(runId);
  }

  private makeTurnDeps(): RunnerDeps<"turn_generation"> {
    return {
      registry: turnGenRegistry,
      loadTemplate: async (id) => this.templateSvc.load("turn_generation", id),
      loadModelProfile: async (id) => this.inferenceSvc.loadModelProfile(id),
      makeAdapter: (cfg) => this.inferenceSvc.makeAdapter(cfg),
      budgetFactory: (max) => this.budgetSvc.forMaxTokens(max),
    };
  }

  // wire these in your app bootstrap
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private templateSvc!: { load: (task: "turn_generation", id: string) => Promise<any> };
  private inferenceSvc!: {
    loadModelProfile: (id: string) => Promise<any>;
    makeAdapter: (cfg: any) => any;
  };
  private budgetSvc!: { forMaxTokens: (max?: number) => any };
}
```

> At bootstrap, set `RunnerHub.instance().templateSvc = ...` etc., or swap to DI.

---

## Binding Resolver

```ts
// apps/backend/src/services/intent/binding-resolver.ts
import type { GenWorkflow } from "@storyforge/gentasks/src/runner/types";

export interface TurnGenBinding {
  workflowId: string;
}

export class BindingResolver {
  async resolveTurnGenBinding(args: {
    scenarioId: string;
    actorParticipantId?: string; // scope precedence: participant > character > scenario > default
  }): Promise<TurnGenBinding> {
    // TODO: read from gentask_bindings table when available.
    return { workflowId: "turngen.default.v1" };
  }

  async loadWorkflow(workflowId: string): Promise<GenWorkflow<"turn_generation">> {
    // TODO: replace with your workflow store
    throw new Error("loadWorkflow not implemented");
  }
}
```

---

## Context Builder

```ts
// apps/backend/src/services/intent/context-builder.ts
import type { SqliteDatabase } from "@storyforge/db";
import { getTimelineWindow, getTurnContentLayers } from "@/services/turn/turn.queries";
import type { TurnGenCtx, CharacterCtxDTO, TurnCtxDTO } from "@storyforge/gentasks/src/types";

export class TurnGenContextBuilder {
  constructor(private db: SqliteDatabase) {}

  async build(args: {
    scenarioId: string;
    actor: { participantId: string; name: string };
    intent: { description: string; constraint?: string };
    personaName?: string; // optional player proxy
  }): Promise<TurnGenCtx> {
    const { scenarioId, actor, intent, personaName } = args;

    const { rows, depth } = await this.loadActivePath(scenarioId);
    const turnIds = rows.map((r) => r.id);
    const layers = await getTurnContentLayers(this.db, turnIds);
    const layerMap = new Map(layers.map((l) => [l.turnId, l.contentLayers]));

    const turns: TurnCtxDTO[] = rows.map((r) => ({
      turnNo: r.turn_no,
      authorName: await this.authorName(r.author_participant_id),
      authorType: "character", // TODO: mark narrator when applicable
      content: layerMap.get(r.id)?.presentation ?? r.content ?? "",
    }));

    const characters: CharacterCtxDTO[] = await this.loadScenarioCharacters(scenarioId);

    return {
      turns,
      chapterSummaries: [], // chapters not implemented yet
      characters,
      currentIntent: intent,
      stepInputs: {},
      globals: {
        stCurrentCharName: actor.name,
        stPersonaName: personaName ?? "",
        scenarioDescription: "", // TODO: supply when available
      },
    };
  }

  private async loadActivePath(scenarioId: string) {
    const probe = await getTimelineWindow(this.db, {
      scenarioId,
      leafTurnId: null,
      windowSize: 1,
    });
    const depth = probe[0]?.timeline_depth ?? 0;
    const rows = depth
      ? await getTimelineWindow(this.db, { scenarioId, leafTurnId: null, windowSize: depth })
      : [];
    return { rows, depth };
  }

  private async authorName(participantId: string): Promise<string> {
    // TODO: join scenarioParticipants -> characters to obtain display name
    return participantId;
  }

  private async loadScenarioCharacters(_scenarioId: string): Promise<CharacterCtxDTO[]> {
    // TODO: query scenario participants (characters) and shape DTOs
    return [];
  }
}
```

---

## Intent Orchestrator

```ts
// apps/backend/src/services/intent/intent-orchestrator.ts
import { nanoid } from "nanoid";
import type { SqliteDatabase } from "@storyforge/db";
import { RunnerHub } from "@/services/runner/runner-hub";
import { TimelineService } from "@/services/turn/timeline.service";
import { TurnGenContextBuilder } from "./context-builder";
import { BindingResolver } from "./binding-resolver";
import type { CreateIntentArgs, PlannedEffect } from "./types";
import { IntentSupervisor } from "./intent-supervisor";

export class IntentOrchestrator {
  constructor(
    private db: SqliteDatabase,
    private binding: BindingResolver = new BindingResolver(),
    private ctxBuilder: TurnGenContextBuilder = new TurnGenContextBuilder(db)
  ) {}

  async create(args: CreateIntentArgs): Promise<{ intentId: string }> {
    await this.ensureNoPending(args.scenarioId);

    const effects: PlannedEffect[] = this.planEffects(args);

    const intentId = nanoid();
    const now = Date.now();

    const runId = nanoid(); // placeholder; will be replaced after run starts
    await this.insertIntent({
      id: intentId,
      scenarioId: args.scenarioId,
      kind: args.kind,
      status: "pending",
      runId,
      workflowId: "TBD",
      inputsJson: JSON.stringify(args),
      createdAt: now,
      updatedAt: now,
    });

    await this.insertEffects(intentId, effects, now);

    // Apply deterministic effects immediately (direct control: insert_turn)
    await this.applyImmediateEffects(args, intentId, effects);

    // Build context and start run for the generate_turn effect
    const genIdx = effects.findIndex((e) => e.kind === "generate_turn");
    if (genIdx >= 0) {
      const actorParticipantId = String(effects[genIdx].payload["participantId"]);
      const actorName = String(effects[genIdx].payload["actorName"] ?? actorParticipantId);

      const binding = await this.binding.resolveTurnGenBinding({
        scenarioId: args.scenarioId,
        actorParticipantId,
      });
      const workflow = await this.binding.loadWorkflow(binding.workflowId);

      const ctx = await this.ctxBuilder.build({
        scenarioId: args.scenarioId,
        actor: { participantId: actorParticipantId, name: actorName },
        intent:
          args.kind === "direct_control"
            ? { description: "Player direct control" }
            : { description: args.description, constraint: args.constraint },
      });

      const runner = RunnerHub.instance();
      const handle = await runner.startTurnRun(workflow, ctx);

      await this.updateIntentRunAndWorkflow(intentId, handle.id, workflow.id);

      // Supervise & commit generated effect
      new IntentSupervisor(this.db).watch({
        intentId,
        runId: handle.id,
        genEffectIndex: genIdx,
      });
    }

    return { intentId };
  }

  // ----- planning -----

  private planEffects(args: CreateIntentArgs): PlannedEffect[] {
    if (args.kind === "direct_control") {
      return [
        {
          index: 0,
          kind: "insert_turn",
          payload: {
            participantId: args.authorParticipantId,
            chapterId: args.chapterId,
            layer: "presentation",
            content: args.playerText,
          },
        },
        {
          index: 1,
          kind: "generate_turn",
          payload: {
            // v0: round-robin, or simple next actor
            participantId: "NEXT_ACTOR_PARTICIPANT_ID",
            actorName: "NEXT_ACTOR_NAME",
            chapterId: args.chapterId,
          },
        },
      ];
    }

    // story_constraint
    return [
      {
        index: 0,
        kind: "generate_turn",
        payload: {
          participantId: "NEXT_ACTOR_PARTICIPANT_ID",
          actorName: "NEXT_ACTOR_NAME",
          chapterId: args.chapterId,
          constraint: args.constraint,
        },
      },
    ];
  }

  // ----- db ops (implement using drizzle) -----

  private async ensureNoPending(scenarioId: string) {
    // SELECT ... WHERE scenario_id=? AND status='pending' LIMIT 1; throw if exists
  }

  private async insertIntent(row: {
    id: string;
    scenarioId: string;
    kind: string;
    status: string;
    runId: string;
    workflowId: string;
    actorParticipantId?: string;
    inputsJson: string;
    createdAt: number;
    updatedAt: number;
  }) {
    // INSERT INTO intents ...
  }

  private async updateIntentRunAndWorkflow(intentId: string, runId: string, workflowId: string) {
    // UPDATE intents SET run_id=?, workflow_id=?, updated_at=?
  }

  private async insertEffects(intentId: string, effects: PlannedEffect[], now: number) {
    // INSERT INTO intent_effects for each effect with status='planned'
  }

  // ----- immediate effects -----

  private async applyImmediateEffects(args: CreateIntentArgs, intentId: string, effects: PlannedEffect[]) {
    const tl = new TimelineService(this.db);
    const now = Date.now();

    for (const e of effects) {
      if (e.kind !== "insert_turn") continue;
      const participantId = String(e.payload["participantId"]);
      const chapterId = String(e.payload["chapterId"]);
      const layer = String(e.payload["layer"]);
      const content = String(e.payload["content"]);

      const turn = await tl.advanceTurn({
        scenarioId: args.scenarioId,
        authorParticipantId: participantId,
        chapterId,
        layers: [{ key: layer, content }],
      });

      // UPDATE intent_effects SET status='applied', turn_id=?, applied_at=?, updated_at=? WHERE intent_id=? AND index=?
      void turn; void intentId; void now; // implement update
    }
  }
}
```

> Replace `"NEXT_ACTOR_*"` with your round-robin selector; keep payload structure as-is.

---

## Intent Supervisor

```ts
// apps/backend/src/services/intent/intent-supervisor.ts
import type { SqliteDatabase } from "@storyforge/db";
import { RunnerHub } from "@/services/runner/runner-hub";
import { TimelineService } from "@/services/turn/timeline.service";

export class IntentSupervisor {
  constructor(private db: SqliteDatabase) {}

  async watch(args: { intentId: string; runId: string; genEffectIndex: number }) {
    const { intentId, runId, genEffectIndex } = args;

    const handle = RunnerHub.instance().attachTurnRun(runId);
    if (!handle) {
      // UPDATE intents SET status='failed', error='Run not found', updated_at=?
      return;
    }

    try {
      // Option A: just await the result promise
      const { finalOutputs } = await handle.result;
      const text =
        (finalOutputs["presentationText"] as string) ??
        (finalOutputs["assistantText"] as string) ??
        "";

      // Load planned effect payload for author + chapter
      // SELECT * FROM intent_effects WHERE intent_id=? AND index=?;
      const effect = /* query planned effect */ null as unknown as {
        payloadJson: string;
      };
      const payload = effect ? (JSON.parse(effect.payloadJson) as Record<string, unknown>) : {};
      const participantId = String(payload["participantId"]);
      const chapterId = String(payload["chapterId"]);

      const tl = new TimelineService(this.db);
      const turn = await tl.advanceTurn({
        scenarioId: await this.intentScenarioId(intentId),
        authorParticipantId: participantId,
        chapterId,
        layers: [{ key: "presentation", content: text }],
      });

      const now = Date.now();
      // UPDATE intent_effects SET status='applied', turn_id=?, applied_at=?, updated_at=? WHERE intent_id=? AND index=?
      // UPDATE intents SET status='finished', final_outputs_json=?, updated_at=? WHERE id=?

      void turn; void now; // implement updates
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // UPDATE intents SET status='failed', error=?, updated_at=? WHERE id=?
      // UPDATE intent_effects (genEffectIndex) SET status='failed', updated_at=?
      void msg;
    }
  }

  private async intentScenarioId(_intentId: string): Promise<string> {
    // SELECT scenario_id FROM intents WHERE id=?;
    return "";
  }
}
```

---

## tRPC Endpoints (play router)

```ts
// apps/backend/src/api/routers/play.ts
import { z } from "zod";
import { ServiceError } from "@/service-error";
import { publicProcedure, router } from "../index";
import { IntentOrchestrator } from "@/services/intent/intent-orchestrator";
import { RunnerHub } from "@/services/runner/runner-hub";
import {
  createIntentInputSchema,
  createIntentOutputSchema,
  intentProgressInputSchema,
  intentResultInputSchema,
  intentResultOutputSchema,
} from "@storyforge/schemas";

export const playRouter = router({
  // ... existing routes

  createIntent: publicProcedure
    .meta({
      openapi: { method: "POST", path: "/api/play/intent", tags: ["play"], summary: "Creates a new intent to influence the story" },
    })
    .input(createIntentInputSchema)
    .output(createIntentOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const orchestrator = new IntentOrchestrator(ctx.db);
      const { intentId } = await orchestrator.create(input);
      return { intentId };
    }),

  intentProgress: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/play/intent/{intentId}/subscribe",
        tags: ["play"],
        summary: "Subscribes to updates on a pending intent's progress",
        enabled: false,
      },
    })
    .input(intentProgressInputSchema)
    .subscription(async function* ({ input, ctx }) {
      // This should go in intent-orchestrator.ts service module, but is shown
      // in the procedure for brevity of the example.
      
      // Resolve intent -> run_id (query intents)
      const row = await ctx.db.query.intents.findFirst({
        where: { id: input.intentId },
        columns: { runId: true, status: true, error: true },
      });
      if (!row) {
        throw new ServiceError("NotFound", { message: `Intent ${input.intentId} not found` });
      }
      const handle = RunnerHub.instance().attachTurnRun(row.runId);
      if (!handle) {
        // If run not attachable (e.g., server restart), emit terminal snapshot
        yield { type: "run_error", runId: row.runId, error: "Run not available", ts: Date.now() };
        // Also set intent status to failed since it will never complete
        return;
      }
      for await (const evt of handle.events()) {
        yield evt;
      }
    }),

  intentResult: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/play/intent/{intentId}",
        tags: ["play"],
        summary: "Gets the status and results of an intent",
      },
    })
    .input(intentResultInputSchema)
    .output(intentResultOutputSchema)
    .query(async ({ input, ctx }) => {
      // This should go in an intents.queries.ts service module, but is shown
      // in the procedure for brevity of the example.
      const row = await ctx.db.query.intents.findFirst({
        where: { id: input.intentId },
        columns: { status: true, error: true, finalOutputsJson: true },
        with: { effects: { columns: { kind: true, status: true, turnId: true } } },
      });
      if (!row) throw new ServiceError("NotFound", { message: `Intent ${input.intentId} not found` });

      return {
        status: row.status,
        error: row.error ?? null,
        effects: row.effects.map((e) => ({
          kind: e.kind,
          status: e.status,
          turnId: e.turnId ?? null,
        })),
      };
    }),
});
```

---

## Workflow Output Contract (turn_generation)

Ensure your **turn_generation** workflow captures final text under a stable key:

```ts
// example gen step config
outputs: [
  { key: "presentationText", capture: "assistantText" },
  // optionally: { key: "plan", capture: "jsonParsed" }
]
```

The supervisor reads `presentationText` (fallback to `assistantText`) and writes it to the `presentation` layer.

---

## Notes for Fill-Ins

* **Next Actor Selection**: replace placeholder `"NEXT_ACTOR_*"` with a v0 round-robin selector over scenario participants (characters), seeded from the last anchor turn’s author.
* **Author Names**: fill `authorName()` with a join from `scenarioParticipants` → `characters`.
* **Scenario Description**: wire when column exists; for now leave empty string.
* **DB Ops**: the orchestrator/supervisor mark `intent_effects` rows `applied/failed` and update `turn_id`. Implement the UPDATE/INSERTs using your Drizzle layer.
* **Resilience**: the RunStore is in-memory; after process restarts, `intentProgress` will fall back to terminal error. The `intents` table still reflects terminal state so the UI can re-query `intentResult` and reload timeline. If you later externalize the store, `RunnerHub.attachTurnRun` remains the same.
