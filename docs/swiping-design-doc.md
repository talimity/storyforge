# Design: Branching (“Swipes”) v1

This document specifies the first implementation of **branching (“swipes”)** in Storyforge. This design reuses the existing **rooted turn tree** and **active timeline (root→anchor)** model, and builds on the **cursor‑by‑ancestor** timeline API that already returns minimal turn data plus sibling (“swipe”) hints.

---

## 1) Background & context

Storyforge is a single‑user desktop application for directing semi‑autonomous characters in a turn‑based narrative, emphasizing **branching as a first‑class concept** and enabling low‑friction exploration of alternate paths.

The **timeline** is a rooted tree of turns; the **active timeline** is the path from the root to the **anchor** leaf, which is also the context for generation. The existing `getTimelineWindow` API provides one content layer (default: `presentation`) for each turn in a sliding window, and includes swipe metadata (`left_turn_id`, `right_turn_id`, `swipe_count`, `swipe_no`) so the UI can hint at alternates without loading every branch.

Branching is intent‑agnostic. Any intent kind (manual control, guided control, narrative constraint, continue story, etc.) could optionally be executed **from an earlier point** in the timeline, which creates an alternate branch. Otherwise, intents default to extending the active timeline, using the `advanceTurn` operation.

Alternate branches can be previewed in the UI. The client can supply an arbitrary leaf cursor to the `timeline` API and receive turns up from that leaf, even if the requested leaf is not the scenario's anchor. This repesents a 'preview' interaction: a view of one linear path through the scenario other than one from root -> scenario anchor.

Since many timeline mutations implicitly apply to the active timeline, the UI disables most interactions when the user is previewing the non-active timeline (the user cannot submit new intents/generations when in the branch preview). The user can exit the preview UI by returning to the original timeline, or they can formally switch the scenario's active timeline to this new one; in this case, the client asks the server to update the scenario's anchor to the new timeline's leaf.

For data consistency, the scenario anchor MUST always be a leaf node (ie. it can have no children). When the server is asked to switch the scenario's anchor, it needs to ensure the requested node is actually a leaf. If it is not, it should walk the tree down to find the deepest leaf under the requested node and use that as the new anchor.

If a generation is in progress, the UI does not allow previewing alternate timelines. This is merely to simplify UI, since the Draft Turn display that appears during an ongoing generation assumes the user is viewing the active timeline.

If a generation is in progress, the server does not allow switching the active timeline (since ongoing intents are appending to the active timeline).

Repository structure and affected modules are under `apps/backend/src/services/{timeline,intent}` and `apps/frontend/src/features/scenario-player/*`.

---

## 2) Goals & non‑goals

### Goals

1. Allow branching from any earlier point **independent of intent kind**.
2. Make branching predictable by adopting **anchor‑on‑insert**: any `new_turn` moves the anchor to that new leaf.
3. Provide a **preview** affordance in the UI to browse other branches (by leaf cursor) without touching anchor.
4. Enforce that **commit (anchor switch)** is blocked when a generation is running; UI also disables preview during generation.
5. Support two UX patterns (no special backend coupling required):

    * **Retry single turn**: branch from the **parent** of a specific turn.
    * **Retry entire intent**: branch from the **parent of the first `new_turn`** effect of that prior intent (replay the whole run with same/tweaked inputs).

### Non‑goals (v1)

* No swipe **naming**, **labels**, or bulk branch management UI.
* No **sibling reordering** UX (beyond creating new alternates).
* No multi‑branch **graph view**—the main player continues to show a single timeline path at a time.
* No new schema/migrations; reuse the existing model.

---

## 3) Existing building blocks (recap)

* **Turn tree** with `parent_turn_id` and lexorank `sibling_order`; “left/right sibling” and sibling counts are derivable.
* **Anchor leaf** marks the active timeline.
* **Timeline API** implements **cursor‑by‑ancestor** (fetch a window from a specified **leaf** upward, then return root→leaf ordering for display). The response includes `left_turn_id`, `right_turn_id`, `swipe_count`, `swipe_no`.
* **Advance** currently sets anchor to the newly created turn.
* **Delete** logic already includes a recursive CTE to resolve the **first‑child path leaf** when adjusting anchor; we will extract and reuse that.
* **Content layers** require a `presentation` layer and disallow duplicate layer keys (validation exists).
* **Chapter progression** rules already enforced (same chapter or next chapter; root insertion only for first chapter).
  These invariants live under `apps/backend/src/services/timeline/invariants/*` and are used by the service.
* **Monorepo layout** (APIs/routers, services, frontend features) is stable.

---

## 4) Design overview

* **Branch origin is orthogonal to intent kind.** We introduce a generic `branchFrom` option to `play.createIntent` inputs:

    * `turn_parent`: branch from **the parent** of a given turn (retry that beat).
    * `intent_start`: branch from **the parent of the first `new_turn`** created by a referenced prior intent (retry the entire run).
* **Anchor‑on‑insert (uniform rule).** Whether appending to anchor (**advance**) or inserting under an earlier parent (**branch**), when a `new_turn` is inserted, the service **always** updates `scenarios.anchor_turn_id` to that newly created turn.
* **Preview is UI‑only.** To preview a branch, the UI asks the timeline API for a window using an arbitrary **leaf cursor** (does not change anchor). A top banner offers **Commit** (server switches anchor) or **Exit** (clear preview).

    * **Server guard:** `switchTimeline` rejects if a generation is running.
    * **UI guard:** while generating, **preview is disabled** (simplifies DraftTurn UI).

---

## 5) Backend changes

### 5.1 Contracts (`packages/contracts/src/schemas/play.ts`)

**Do not** add any “commit policy”. **Do** add a generic, intent‑agnostic branching origin:

```ts
// New discriminated union for branch origin
export const branchFromSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("turn_parent"), id: z.string() }),
  z.object({ kind: z.literal("intent_start"), id: z.string() }),
]);

// Extend createIntent input (parameters remain the kind-specific payload)
export const createIntentInputSchema = z.object({
  scenarioId: z.string(),
  parameters: intentInputSchema,
  branchFrom: branchFromSchema.optional(),
});
```

**Keep** the timeline contracts as‑is (cursor‑by‑ancestor; swipe metadata on each row).

Add two small helpers for preview/commit ergonomics:

```ts
export const resolveLeafInputSchema = z.object({
  scenarioId: z.string(),
  fromTurnId: z.string(), // any node
});
export const resolveLeafOutputSchema = z.object({ leafTurnId: z.string() });

export const switchTimelineInputSchema = z.object({
  scenarioId: z.string(),
  leafTurnId: z.string(), // server ensures this is actually the bottom of a timeline
});
export const switchTimelineOutputSchema = z.object({ success: z.boolean() });
```

### 5.2 Timeline service (`apps/backend/src/services/timeline/timeline.service.ts`)

**A. Extract leaf resolver**
Move the existing recursive CTE that finds the **first‑child path leaf** (currently in deletion planner as `findLeafFromProposedAnchor`) into a shared utility, e.g. `resolveLeafFrom(tx, fromTurnId): Promise<string>`. We will use it from both deletion and preview/commit code paths.

**B. New `branchTurn` (anchor‑on‑insert)**
Add a public method to insert a new turn under an explicit parent (or `null`) **and update anchor**:

```ts
async branchTurn(args: {
  scenarioId: string;
  authorParticipantId: string;
  parentTurnId: string | null; // null = new root child (first chapter)
  chapterId?: string;          // defaults to parent's chapter
  layers: { key: string; content: string }[]; // must include presentation
}, outerTx?: SqliteTransaction) {
  const op = async (tx: SqliteTransaction) => {
    // load parent if provided; set target chapter (default: parent.chapterId)
    // reuse invariant checks via private insertTurn(...)
    const turn = await this["insertTurn"](
      { ...args, chapterId: args.chapterId ?? (await loadParentChapterId(tx, args.parentTurnId)) },
      tx
    );

    // new turn becomes anchor
    await tx.update(schema.scenarios)
      .set({ anchorTurnId: turn.id })
      .where(eq(schema.scenarios.id, args.scenarioId));

    return turn;
  };
  return outerTx ? op(outerTx) : this.db.transaction(op);
}
```

> Notes:
> • Invariants enforced by `validateTurnLayers`, `canCreateTurn`, `canAppendTurnToChapter` remain unchanged.
> • `canAppendTurnToChapter` already allows **same chapter** or **next chapter**, and only allows **root insertion** when targeting the **first chapter**.

**C. Keep `advanceTurn` behavior** (already sets anchor → new leaf).

### 5.3 Intent pipeline (branch‑aware, kind‑agnostic)

**Files:**

* `apps/backend/src/services/intent/intent.service.ts`
* `apps/backend/src/services/intent/commands.ts`
* `apps/backend/src/services/intent/executors.ts`

**A. Resolve branch origin in `IntentService.createAndStart`**
Compute `startFromTurnId: string | null` based on optional `branchFrom`:

* `turn_parent`: fetch the target `turn`; use its `parentTurnId` (may be `null` for root).
* `intent_start`: fetch that intent’s `intent_effects` (ordered by `sequence`), take its **first** `new_turn`, load that turn’s `parentTurnId`.

Pass `startFromTurnId` into the executor factory.

**B. Commands: parameterize insert & generation with branch context**
Update command helpers to thread an **origin turn** (for both inserting and building prompts):

```ts
insertTurn: async function* ({
  actorId, text, underTurnId
}: { actorId: string; text: string; underTurnId?: string | null }) {
  const [effect] = await db.transaction(async (tx) => {
    const turn = (underTurnId !== undefined)
      ? await timeline.branchTurn({
          scenarioId, authorParticipantId: actorId,
          parentTurnId: underTurnId ?? null,
          layers: [{ key: "presentation", content: text }]
        }, tx)
      : await timeline.advanceTurn({
          scenarioId, authorParticipantId: actorId,
          layers: [{ key: "presentation", content: text }]
        }, tx);

    const seq = await getNextEffectSequence(tx, intentId);
    return tx.insert(schema.intentEffects)
      .values({ intentId, sequence: seq, kind: "new_turn", turnId: turn.id })
      .returning();
  });
  // ...emit events...
  return { turnId: effect.turnId };
},

generateTurn: async function* ({
  actorId, constraint, fromTurnId
}: { actorId: string; constraint?: string; fromTurnId?: string | null }) {
  const ctx = await new IntentContextBuilder(db, scenarioId).buildContext({
    actorParticipantId: actorId,
    leafTurnId: fromTurnId ?? null, // ensure prompts reflect the chosen branch path
    intent: /* map from intent kind to message for templates */,
  });
  // run workflow; stream tokens/events; return { presentation, outputs }
},
```

**C. Executors: thread `startFromTurnId` into all kinds**
Each executor (manual, guided, narrative constraint, continue story) keeps its behavior, but **if** `startFromTurnId` is defined, it passes it to the first `generateTurn({ fromTurnId: startFromTurnId })` and inserts via `insertTurn({ underTurnId: startFromTurnId })`. Since the `insertTurn` service will automatically update the anchor, any subsequent generate/insert commands after the first don't need to pass `startFromTurnId`.

### 5.4 Routers (tRPC)

**File:** `apps/backend/src/api/routers/play.ts` (see repo tree)

* **`play.createIntent`**: accept `branchFrom` (optional) and forward to `IntentService.createAndStart`.
* **`play.resolveLeaf`**: call `resolveLeafFrom(tx, fromTurnId)` and return `{ leafTurnId }`.
* **`play.switchTimeline`**:
    * **Guard:** if a generation is running for this scenario (via run‑manager), reject with a typed error.
    * Otherwise, ensure provided `leafTurnId` is actually a leaf turn (if not, walk down to find one) and then call service layer to update the scenario's anchor to this new leaf.

---

## 6) Frontend changes

### 6.1 Store & environment

**Store:** `scenario-player-store.ts`
Add:

```ts
previewLeafTurnId: string | null;
setPreviewLeaf: (id: string | null) => void;
```

**Environment:** the existing `useScenarioEnvironment(scenarioId)` returns `generatingIntent` (selected in the hook). Use it to compute `isGenerating = Boolean(generatingIntent)` and **disable**:

* stepper arrows,
* preview enter/commit,
* retry actions (regen),
  to keep DraftTurn assumptions trivial while generation is in flight. (The server will also guard `switchTimeline`.)

### 6.2 Timeline hook

**Hook:** `use-scenario-timeline.ts`
Extend options to accept `cursor?: string` and include it in the TRPC key + input (so we fetch a timeline window for **either** anchor **or** preview leaf). The backend already supports an explicit `leafTurnId`.

### 6.3 Stepper UI (sibling navigation)

**Component:** `turn-item.tsx`
Replace the static `X / N` with a left/right stepper that uses the swipe metadata:

```tsx
{turn.swipes?.swipeCount > 1 && (
  <HStack gap="1" align="center">
    <Button size="xs" variant="ghost"
      onClick={() => onSwipe(turn, "left")}
      disabled={isGenerating || !turn.swipes.leftTurnId}>←</Button>
    <Text fontSize="xs" color="content.muted">
      {turn.swipes.swipeNo} / {turn.swipes.swipeCount}
    </Text>
    <Button size="xs" variant="ghost"
      onClick={() => onSwipe(turn, "right")}
      disabled={isGenerating || !turn.swipes.rightTurnId}>→</Button>
  </HStack>
)}
```

**Wiring**:

```ts
const handleSwipe = async (turn: TimelineTurn, dir: "left"|"right") => {
  if (isGenerating) return;
  const siblingId = dir === "left" ? turn.swipes.leftTurnId : turn.swipes.rightTurnId;
  if (!siblingId) return;
  // Ask the server to walk down from the sibling and find a leaf turn
  const { leafTurnId } = await trpc.play.resolveLeaf.mutate({ scenarioId, fromTurnId: siblingId });
  // Now actually set the preview leaf and refresh the tRPC timeline query
  scenarioPlayerStore.setPreviewLeaf(leafTurnId);
  await refetch(); // hook uses preview cursor, so page re-renders this branch
};
```

**Preview banner** at top when `previewLeafTurnId` is set:

```tsx
<Button size="xs" onClick={handleCommitPreview} disabled={isGenerating}>Commit</Button>
<Button size="xs" variant="ghost" onClick={handleExitPreview} disabled={isGenerating}>Exit</Button>
```

Commit and exit:

```ts
const handleCommitPreview = async () => {
  if (!previewLeafTurnId) return;
  await trpc.play.switchTimeline.mutate({ scenarioId, leafTurnId: previewLeafTurnId });
  scenarioPlayerStore.setPreviewLeaf(null); // Active Timeline == preview
  await query.refetch();
};
const handleExitPreview = async () => {
  scenarioPlayerStore.setPreviewLeaf(null);
  await query.refetch(); // back to anchor
};
```

### 6.4 “Retry” actions (intent‑agnostic branching)

**A. Retry single turn (regen one beat)**
In `turn-item.tsx` menu:

```tsx
<Menu.Item onClick={() => onRetryTurn(turn)}>Retry this turn…</Menu.Item>
```

Implementation:

```ts
const onRetryTurn = (turn: TimelineTurn) => {
  if (isGenerating || !turn.parentTurnId) return;
  // let user pick intent kind (default: continue_story; optional: constraint with guidance)
  createIntent.mutate({
    scenarioId,
    parameters: { kind: "continue_story" /* or other kind + inputs */ },
    branchFrom: { kind: "turn_parent", id: turn.id }
  });
  // No preview handling required: the first new_turn auto-anchors to the new branch.
};
```

**B. Retry entire intent (regen series)**
From an “intent ribbon” (later UI), fetch original inputs, allow edits, then:

```ts
createIntent.mutate({
  scenarioId,
  parameters: /* cloned or edited inputs */,
  branchFrom: { kind: "intent_start", id: originalIntentId }
});
```

Again, anchor moves to the first `new_turn` of this fresh run automatically.

---

## 7) Concurrency & guards

* **Server:** `play.switchTimeline` must reject when **any** intent run is `pending/running` for the scenario (expose a `hasActiveRunForScenario(scenarioId)` on run‑manager).
* **UI:** Treat `isGenerating` as a global disable for:

    * left/right stepper,
    * entering preview,
    * committing preview,
    * retry actions.

---

## 8) Testing

**Unit (backend)**

* `TimelineService.branchTurn`

    * Inserts under parent (or root), validates layers, honors progression, sets anchor to new turn.
* Leaf resolver

    * For non‑leaf input with mixed sibling orders, returns **first‑child path** leaf.
* Intent branching

    * `branchFrom: turn_parent` creates sibling under parent.
    * `branchFrom: intent_start` resolves parent of first `new_turn`.
    * In both, the **first** inserted `new_turn` becomes anchor.
* `switchTimeline` guard when running.

**Integration (API)**

* `play.createIntent` with/without `branchFrom`; verify anchor movement and timeline window correctness.
* `play.resolveLeaf` and `play.switchTimeline` end‑to‑end with guard conditions.

**UI (component)**

* Stepper disables while generating
* Intent Panel is replaced with a Preview banner ("You're viewing an alternate timeline.") allowing Switch (commits new anchor) or Return (resets view to active timeline)
* Retry TurnItem actions dispatch the correct inputs.

---

## 9) Migration / compatibility

* **No DB migrations.** We reuse `turns`, `turn_layers`, `intents`, `intent_effects`, and `scenarios.anchor_turn_id`. The invariants already present (`validateTurnLayers`, `canCreateTurn`, `canAppendTurnToChapter`) apply equally to branch inserts.

---

## 10) Detailed API & code sketches

### 10.1 tRPC

```ts
// play.createIntent (extend input only)
type CreateIntentInput = {
  scenarioId: string;
  parameters: IntentInput;             // unchanged kinds
  branchFrom?: { kind: "turn_parent"|"intent_start"; id: string };
};

// play.resolveLeaf
type ResolveLeafInput  = { scenarioId: string; fromTurnId: string };
type ResolveLeafOutput = { leafTurnId: string };

// play.switchTimeline
type SwitchTimelineInput  = { scenarioId: string; leafTurnId: string };
type SwitchTimelineOutput = { success: boolean };
```

### 10.2 Service entrypoints

```ts
// timeline.service.ts
branchTurn({ scenarioId, authorParticipantId, parentTurnId, chapterId, layers }, tx?)
resolveLeafFrom(tx, fromTurnId) -> Promise<string> // extracted from existing CTE in mutation-planner.ts

// intent.service.ts
createAndStart({ scenarioId, parameters, branchFrom? })
  // compute startFromTurnId via branchFrom
  // executors receive { startFromTurnId?: string | null }
```

### 10.3 Commands / executors (branch‑aware)

```ts
// commands.ts
insertTurn({ actorId, text, underTurnId?: string | null })
generateTurn({ actorId, constraint?, fromTurnId?: string | null })

// executors.ts (all kinds)
function continueStory({ startFromTurnId }?: { startFromTurnId?: string | null }) { /* thread through */ }
function manualControl({ startFromTurnId, actorId, text }: ...) { /* thread through */ }
function guidedControl({ startFromTurnId, actorId, constraint }: ...) { /* thread through */ }
function narrativeConstraint({ startFromTurnId, text }: ...) { /* thread through */ }
// Idea: rather than adjusting every intent executor to accept `startFromTurnId`, we may be able to pass this in via
//the closed-over `deps` from the `makeExecutors`, which avoids having to adjust the signature of every executor.
```

---

## 11) Rollout plan

1. **Backend:** ship `resolveLeafFrom`, `branchTurn`, router changes, `branchFrom` plumbing, and guards.
2. **Frontend:** add preview cursor to timeline hook; stepper with preview banner; disable while generating; basic “Retry turn” action wired to `turn_parent`.
3. **QA:** unit + integration tests; manual walkthrough of retry single turn and preview/commit.

---

## 12) Future work

* Swipe naming/labels; “best” swipe pinning.
* Multi‑branch navigation view (“branch map”).
* Retry‑with‑guidance UX (pre‑seed constraints; “make it different from last beat”).

---

### Appendix A — Why “preview is UI‑only”

The existing timeline window is **leaf‑anchored** and already supports an explicit `leafTurnId`. Using this as a **pure view cursor** avoids server mutations, reduces coordination complexity with ongoing generations, and aligns with our mental model: **the active timeline is defined by the path from root -> `scenario.anchorTurnId` and is the stateful target of most interactions; **everything else is just an alternate path the UI is observing statelessly**.
