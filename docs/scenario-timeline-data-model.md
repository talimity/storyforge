# Scenario Timeline & Player Intents

Describes the data model, API contracts, and read/write services for the timeline and player intent systems.

## Definitions
- **Scenario:** a story world with participants, characters, chapters, and turns.
- **Participant:** an entity in the scenario; can be the narrator or a character from user's Library.
- **Character:** a persona with name, avatar, and SillyTavern v2 data; linked to a participant.
- **Turn:** a diegetic narrative unit authored by a participant. Each turn might have multiple layers.
- **Layer:** a specific view of a turn's content, e.g., "presentation" for prose shown to player, "planning" for LLM agents' reasoning, etc.
  - **`presentation` layer:** default layer for player-facing content. Always present; other layers depend on agent configuration.
- **Chapter:** a narrative boundary within the scenario, grouping turns together. Functions as both player-facing label and a boundary for LLM summarization to reduce context size.
- **Timeline:** a path of turns from the scenario start down to the current leaf ('anchor').
- **Swipes:** named after Character.ai swipe feature which allows players to swipe away turns they don't like. In this context, it refers to branches in the timeline. Switching branches is done by changing the scenario's anchor leaf turn.
- **Intent:** a non-diegetic record of player input, which leads to one or more turns being generated. It can be a direct control action, a story constraint, or a quick action.
- **Intent effect:** the mapping of an intent to the turns it caused, with a sequence number indicating the order of effects.

## Decisions

### Timeline fundamentals

- **Paging model:** **cursor-by-ancestor**. Each page asks for `leafTurnId`, returns a window up toward the root (root→leaf order), plus `cursors.nextLeafId` (the parent of the top row) or `null` if you hit root.
- **Window size & overlap:** `windowSize` (e.g., 12) with **overlap=1** so UI can dedupe seamlessly.
- **Turn content:** timeline returns **one layer only** (default `"presentation"`). No fat `contents` map.
- **Swipes:** include prev/next sibling ids **and** `swipeCount` + `swipeIndex` (0‑based). UI shows existence; no switching yet.
- **Numbering:** don’t persist numbers. Return `depthFromAnchor` (relative to session’s present leaf) and `anchorTotalDepth` (once per page).
  UI shows **Turn #** = `anchorTotalDepth - depthFromAnchor`.
- **Skinny timeline:** keep only ids + metadata. Participants/characters/chapters are loaded once via **bootstrap** and cached client‑side.

### Chapters

- A turn belongs to **exactly one chapter**.
- Keep a single `scenario.current_turn_id` (do **not** split the tree per chapter).
- Chapters are *labels/boundaries* along the mainline. Store `chapters.first_turn_id` for crisp boundaries.
- **Chapter numbering** (derived):
  For each row, return `chapterId` and compute `chapterTurnNumber = depthFromAnchorOfChapterStart - depthFromAnchor + 1`.
- Summarization is out of scope now, but the boundary (`first_turn_id`) makes it trivial later.

### Intents & effects

- **Intent** is the player input (mode, text, knobs). It’s not a turn or layer.
- **Intent effects** map an intent → the turn(s) it caused (`sequence` 0..N).
  Direct Control can create the player‑authored turn as `sequence=0`; the engine may add an immediate reaction as `sequence=1`.
- Keep a simple **mock generation** path now (one new prose turn on the mainline).

### Bootstrapping & UI data strategy

- On entering the player, call **`/api/play/bootstrap`** to fetch scenario, participants (+characters), full chapter list. Store in zustand.
- Timeline calls only return ids and requested layer; UI maps names/avatars from store.
- React Query `useInfiniteQuery` with `pageParam = leafTurnId` and `getNextPageParam = nextLeafId`.

---

## API contracts (Zod)

### Bootstrap

```ts
// GET /api/play/bootstrap
const bootstrapInputSchema = z.object({ scenarioId: z.string() });
const bootstrapOutputSchema = z.object({
  scenario: z
    .object({
      id: z.string(),
      title: z.string(),
      rootTurnId: z.string().describe("First turn in the scenario"),
      anchorTurnId: z
        .string()
        .describe("Identifies the last turn in the scenario's active timeline"),
    })
    .describe("Scenario metadata"),
  participants: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["character", "narrator"]),
        status: z.enum(["active", "inactive"]),
        characterId: z.string().nullable(),
      })
    )
    .describe("Participants in the scenario (including narrator)"),
  characters: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        imagePath: z.string().nullable(),
        avatarPath: z.string().nullable(),
      })
    )
    .describe("Characters in the scenario"),
  chapters: z
    .array(
      z.object({
        id: z.string(),
        index: z.number(),
        title: z.string().nullable().optional(),
        firstTurnId: z.string(),
      })
    )
    .describe("Chapters in the scenario, in order"),
  generatingIntent: intentSchema
    .nullable()
    .optional()
    .describe("Currently generating intent, if any"),
});
```

### Timeline

```ts
// GET /api/play/timeline
const loadTimelineInputSchema = z.object({
  scenarioId: z.string(),
  // TODO: anchor turn is maybe burdensome for clients. server can technically
  // walk the tree down from any leaf to find that branch's anchor
  anchorTurnId: z
    .string()
    .describe("Final turn in this timeline; identifies a timeline branch"),
  leafTurnId: z
    .string()
    .optional()
    .describe("Cursor position of this timeline slice (defaults to anchor)"),
  windowSize: z
    .number()
    .min(1)
    .max(20)
    .describe("Number of turns to load, starting from the leaf turn"),
  layer: z
    .string()
    .optional()
    .default("presentation")
    .describe("Content layer to load for each turn"),
});

const timelineTurnSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  chapterId: z.string(),
  parentTurnId: z
    .string()
    .nullable()
    .describe("Previous turn in this timeline (or null for the root turn)"),
  authorParticipantId: z
    .string()
    .describe("Participant ID of the author of this turn"),
  swipes: z
    .object({
      leftTurnId: z
        .string()
        .nullable()
        .describe("Previous sibling turn, forking left"),
      rightTurnId: z
        .string()
        .nullable()
        .describe("Next sibling turn, forking right"),
      swipeCount: z
        .number()
        .describe("Sibling count for this turn, including itself"),
      swipeIndex: z.number().describe("Index of this turn among its siblings"),
    })
    .describe("Swipe (alternate branch) information for this turn"),
  depthFromAnchor: z
    .number()
    .describe("Depth of this turn from the anchor (0 for the anchor turn)"),
  chapterTurnNumber: z
    .number()
    .describe("Turn number within the chapter, starting at 1"),
  layer: z.literal("presentation").describe("The content layer being loaded"),
  content: z
    .object({ text: z.string(), createdAt: z.string(), updatedAt: z.string() })
    .describe("Content for this turn in the specified layer"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const loadTimelineOutputSchema = z.object({
  timeline: z
    .array(timelineTurnSchema)
    .describe("Array of turns in the loaded timeline slice"),
  cursors: z.object({
    nextLeafTurnId: z
      .string()
      .nullable()
      .describe("Cursor for the next page of turns, if any"),
  }),
  timelineDepth: z
    .number()
    .describe("Number of turns in the timeline from root to anchor"),
});
```

### Intents

```ts
// POST /api/play/intent
const createIntentInputSchema = z.object({
  scenarioId: z.string(),
  // todo: maybe this should be object union instead of mode with dependent fields
  mode: z
    .enum(["direct_control", "story_constraint", "quick_action"])
    .default("direct_control")
    .describe("Player's chosen mode of interaction"),
  text: z
    .string()
    .min(1)
    .max(20000)
    .optional()
    .describe(
      "Player's input or prompt (required for direct_control and quick_action modes"
    ),
  selectedParticipantId: z.string().optional(),
  // Intent modes are very much not final
  constraint: z
    .object({
      type: z.enum(["plot", "character", "tone", "pace"]),
      strength: z.number().min(0).max(100).default(50),
    })
    .optional(),
  quickAction: z
    .object({
      type: z.enum(["plot_twist", "surprise_me", "jump_ahead", "focus_on"]),
      targetCharacterId: z.string().optional(),
    })
    .optional(),
});

const intentEffectSchema = z
  .object({
    turnId: z.string().describe("ID of the turn created by this effect"),
    sequence: z
      .number()
      .describe("Order of this effect among all effects in the intent"),
  })
  .describe("Representation of an effect of player's intent (ie. new turns)");

const intentSchema = z
  .object({
    id: z.string(),
    scenarioId: z.string(),
    status: z
      .enum(["pending", "applied", "failed"])
      .describe("Current status of intent"),
    effects: z
      .array(intentEffectSchema)
      .describe("Array of effects created by this intent"),
    anchorTurnId: z
      .string()
      .describe("Timeline anchor turn when this intent was created"),
  })
  .describe("Representation of a player's intent to influence the story");

const createIntentOutputSchema = z.object({ intent: intentSchema });

// GET /api/play/intent/:intentId/result
// just returns the intent + effects
```

---

## DB schema (Drizzle/SQLite)

#### `turns`

- `id TEXT PK`
- `scenario_id TEXT FK`
- `parent_turn_id TEXT FK -> turns.id NULL`
- `chapter_id TEXT FK -> chapters.id NOT NULL`
- `author_participant_id TEXT FK`
- `sibling_order INTEGER NOT NULL` (dense 0..N per parent)
- timestamps

#### `chapters`

- `id TEXT PK`
- `scenario_id TEXT FK`
- `index INTEGER NOT NULL` (0..N)
- `title TEXT NULL`
- `first_turn_id TEXT FK -> turns.id NOT NULL`
- `summary TEXT NULL`
- timestamps

#### `intents`

- `id TEXT PK`
- `scenario_id TEXT FK`
- `anchor_turn_id TEXT FK -> turns.id NOT NULL`
- `mode TEXT CHECK in ('direct_control','story_constraint','quick_action')`
- `text TEXT NULL`
- `selected_character_id TEXT NULL`
- `constraint_type TEXT NULL`
- `constraint_strength INTEGER NULL`
- `quick_action_type TEXT NULL`
- `quick_action_target_character_id TEXT NULL`
- `branch_policy TEXT CHECK in ('mainline','new_branch','replace_leaf') DEFAULT 'mainline'`
- `status TEXT CHECK in ('pending','applied','cancelled','failed') DEFAULT 'pending'`
- timestamps

#### `intent_effects`

- `intent_id TEXT FK -> intents.id`
- `turn_id TEXT FK -> turns.id`
- `sequence INTEGER NOT NULL`
- **PK** `(intent_id, sequence)`

> (Eventually) `generation_runs` for observability; leave stubbed for now.

---

## Read models

1. **`getScenarioBootstrap(scenarioId)`**

- scenario (id, title, currentTurnId), participants (+characterId), characters (id, name, avatar), all chapters (id, index, title, firstTurnId).

2. **`getTurnTimelineWindowCursor({ anchorLeafId, leafTurnId, windowSize, layer })`**

- Recursive CTE: build `anchor` (anchorLeafId→root) to compute `anchorTotalDepth` and per-id `depthFromAnchor`.
- Build `page` (leafTurnId→root), join siblings (prev/next, count, index).
- Slice `LIMIT windowSize` (leaf→root), then order **depth DESC** (root→leaf).
- Compute `nextLeafId = top.parent_turn_id ?? null`.
- Compute `chapterTurnNumber` using the join to anchor and the chapter’s `first_turn_id` depth (grab once; reuse).

3. *(Optional for badges now or later)* **`getIntentProvenanceForTurns(turnIds[])`**

- Map `turnId -> { intentId, mode, … }` from `intent_effects` + `intents`.

---

## Transactional writes

1. **`createIntent(params)`**

- Validate, read `scenario.current_turn_id` as `anchor_turn_id`, insert `intents(pending)`.

2. **`applyIntentWithMock(intentId)`** *(stub engine)*

- Load intent + scenario (for `current_turn_id`).
- **If mode = direct\_control & text**: insert a new turn authored by `selectedCharacterId` with **presentation** content = `text` as **effect `sequence=0`**.
- Always insert one **generated** turn (mock provider) as **effect `sequence=last+1`**:

- parent = current leaf after the previous effect (or the anchor if none)
- chapter\_id = parent.chapter\_id (inherit)
- author\_participant\_id = pick narrator (simplest)
- sibling\_order = append to parent’s children
- Update `scenario.current_turn_id` to the last new turn.
- Upsert `intent_effects` for each created turn; set `intents.status='applied'`.

3. **`advanceTurn(params)`** *(low-level creator used by the stub above)*

- Insert turn under a parent, maintain `sibling_order`, inherit `chapter_id` unless overridden.

4. **`startNewChapter(scenarioId, title?)`**

- Read `scenario.current_turn_id`, create chapter with `first_turn_id` at that leaf, `index = max(index)+1`.

---

## Routers (tRPC)

- `play.bootstrap` → `getScenarioBootstrap`
- `play.timeline` → `getTurnTimelineWindowCursor`
- `play.createIntent` → `createIntent`
- `play.intentProgress` → async generator yielding events from turn engine (stubbed for now)
- `play.intentResult` → load `intent` + `intent_effects`, plus updated `scenario.current_turn_id`

---

## Engine modules to stub

- **`engine/turns/mock-effect-writer.ts`**
  `renderMockTurn({ mode, text, selectedCharacterName }) => string` (does not call LLM, just returns a test string).

---

## Frontend wiring (minimum)

- **Bootstrap on mount:** put result in zustand (`participantsById`, `charactersById`, `chaptersById`).
- **Timeline list:** `useInfiniteQuery({ initialPageParam: anchorLeafId, getNextPageParam: nextLeafId })`; flatten and dedupe by `turn.id`.
- **Input panel:** POST `intent`, then subscribe to `play.intentProgress` for updates; invalidate timeline with new `anchorTurnId`.

---

## Test plan (quick hits)

- **Migrations**: create sample scenario with 1 chapter, 3 turns.
- **Queries**: assert timeline windows (order, overlap, cursors), swipes metadata present, chapterTurnNumber math correct.
- **Writes**: create intent → apply mock → effects inserted in order, `current_turn_id` advanced, chapter inheritance correct.
- **Router**: end-to-end `bootstrap → timeline → intent → result → timeline (new leaf)`.
