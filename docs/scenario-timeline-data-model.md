# Scenario Timeline & Player Intents

Describes the data model, API contracts, and read/write services for the timeline and player intent systems.

## Definitions
- **Scenario:** a story world with participants, characters, chapters, and turns.
- **Participant:** an entity in the scenario; can be the narrator or a character from user's Library.
- **Character:** a persona with name, avatar, and SillyTavern v2 data; linked to a participant.
- **Turn:** a diegetic narrative unit authored by a participant. Each turn might have multiple content layers.
- **Layer:** a specific view of a turn's content, e.g., "presentation" for prose shown to player, "planning" for LLM agents' reasoning, etc.
  - **`presentation` layer:** default layer for player-facing content. Always present; other layers depend on agent configuration.
- **Chapter:** a narrative boundary within the scenario, grouping turns together. Functions as both player-facing label and a boundary for LLM summarization to reduce context size.
- **Swipes:** named after Character.ai swipe feature which allows players to swipe away turns they don't like. In this context, it refers to branches in the timeline.
  - Siblings/swipes are always alternate takes on the same situation (the parent turn). 
- **Turn Graph:** a rooted tree structure of turns, where each turn can have multiple children (swipes) and a single parent.
- **Timeline:** a path from scenario root `r` to some leaf turn `l`, representing a continuous narrative flow.
    - **Root turn:** the first turn in the scenario, from which all timelines start.
    - **Leaf turn:** a turn with no children, representing the end of one narrative branch.
    - **Anchor turn:** the leaf turn for the branch currently being played by the user. It represents the current state of the scenario.
    - **Active timeline:** the path from `r` to anchor turn `a`; the timeline that is displayed in the main UI and used to build prompts for LLM agents.
- **Intent:** a non-diegetic record of player input, which leads to one or more turns being generated. It can be a direct control action, a story constraint, or a quick action.
- **Intent effect:** the mapping of an intent to the turns it caused, with a sequence number indicating the order of effects.

## Decisions

### Timeline API

- **Paging model:** **cursor-by-ancestor**. Each page asks for `leafTurnId`, returns a window up toward the root (root→leaf order), plus `cursors.nextLeafId` (the parent of the top row) or `null` if you hit root.
- **Window size:** `windowSize` (e.g., 12) is the number of turns to return, starting from the leaf turn. The server computes the slice from the leaf up to the root.
- **Turn content:** timeline returns **one layer only** (default `"presentation"`).
- **Swipes:** include prev/next sibling ids `swipeCount` + `swipeNo` (1-based) for each turn. Allows UI to hint at alternate branches without loading all branches.
- **Numbering:** turn numbers derived by server by traversing the tree from the leaf up to the root. Each turn has a `turnNo` (1-based relative to root) for UI display.
- **Skinny timeline:** timeline API returns only ids + metadata. Participants/characters/chapters are loaded once via **play.environment** and cached client‑side.

### Chapters

- A turn belongs to **exactly one chapter**.
- Keep a single `scenario.anchor_turn_id` (do **not** split the tree per chapter).
- Chapters are *labels/boundaries* along the mainline. ~~Store `chapters.first_turn_id` for crisp boundaries.~~
~~- **Chapter numbering** (derived):~~
  ~~For each row, return `chapterId` and compute `chapterTurnNumber = depthFromAnchorOfChapterStart - depthFromAnchor + 1`.~~
  - Droppped firstTurnId, since chapters might have multiple first turns. Tricky...
- Chapters are not a separate tree, they are just labels on turns.
  - Therefore, chapter boundaries are derived from the turn graph, not stored explicitly.
- Because start and end points for chapters are not fixed and depend on the selected timeline, there can't be just one summary for a chapter.
  - Summaries will be stored on the turn that acts as the end of a chapter for a given timeline.
  - Switching branches may change the shape of a chapter, and so a summary will need to be generated for the new path through the chapter.
  - This suggests the need for some sort of hash to identify when a summary is valid for a given chapter path, or to invalidate it when the path changes.

### Intents & effects

- **Intent** is the player input (mode, text, knobs). It’s not a turn or layer.
- **Intent effects** map an intent → the turn(s) it caused (`sequence` 0..N).
  Direct Control can create the player‑authored turn as `sequence=0`; the engine may add an immediate reaction as `sequence=1`.
- Keep a simple **mock generation** path now (one new prose turn on the mainline).

### Bootstrapping & UI data strategy

- On entering the player, call **`/api/play/environment`** to fetch scenario, participants (+characters), full chapter list.
- Timeline calls only return ids, turn numbers, and requested content; UI maps names/avatars from store.
- React Query `useInfiniteQuery` with `pageParam = leafTurnId` and `getNextPageParam = nextLeafId`.

---

## API contracts (Zod)

### Environment bootstrap

```ts
// GET /api/play/environment
export const environmentInputSchema = z.object({
  scenarioId: z.string(),
});

export const environmentOutputSchema = z.object({
  scenario: z
    .object({
      id: z.string(),
      title: z.string(),
      rootTurnId: z.string().nullable().describe("First turn in the scenario"),
      anchorTurnId: z
        .string()
        .nullable()
        .describe("Identifies the last turn in the scenario's active timeline"),
    })
    .describe("Scenario metadata"),
  participants: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["character", "narrator", "deleted_character"]),
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
        title: z.string().nullable(),
      })
    )
    .describe("Chapters in the scenario, in order"),
  generatingIntent: z
    .lazy(() => intentSchema)
    .nullable()
    .describe("Currently generating intent, if any"),
});
```

### Timeline

```ts
// GET /api/play/timeline

// Timeline API schemas
export const loadTimelineInputSchema = z.object({
  scenarioId: z.string(),
  cursor: z
    .string()
    .optional()
    .describe("ID of leaf turn of this timeline slice (defaults to anchor)"),
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

export const timelineTurnSchema = z.object({
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
  turnNo: z
    .number()
    .describe("1-based position of this turn from the timeline root"),
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
      swipeNo: z
        .number()
        .describe("1-based position of this swipe among its siblings"),
    })
    .describe("Swipe (alternate branch) information for this turn"),
  layer: z.literal("presentation").describe("The content layer being loaded"),
  content: z
    .object({ text: z.string(), createdAt: z.string(), updatedAt: z.string() })
    .describe("Content for this turn in the specified layer"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const loadTimelineOutputSchema = z.object({
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
export const createIntentInputSchema = z.object({
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
  // TODO: still need to think through these modes more
  // constraint: z
  //   .object({
  //     type: z.enum(["plot", "character", "tone", "pace"]),
  //     strength: z.number().min(0).max(100).default(50),
  //   })
  //   .optional(),
  // quickAction: z
  //   .object({
  //     type: z.enum(["plot_twist", "surprise_me", "jump_ahead", "focus_on"]),
  //     targetCharacterId: z.string().optional(),
  //   })
  //   .optional(),
});

export const intentEffectSchema = z
  .object({
    turnId: z.string().describe("ID of the turn created by this effect"),
    sequence: z
      .number()
      .describe("Order of this effect among all effects in the intent"),
  })
  .describe("Representation of an effect of player's intent (ie. new turns)");

export const intentSchema = z
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
```

---

## DB schema (Drizzle/SQLite)

#### `turns`

- `id TEXT PK`
- `scenario_id TEXT FK`
- `parent_turn_id TEXT FK -> turns.id NULL`
- `chapter_id TEXT FK -> chapters.id NOT NULL`
- `author_participant_id TEXT FK`
- `sibling_order TEXT NOT NULL` (lexorank-ish)
- timestamps

#### `chapters`

- `id TEXT PK`
- `scenario_id TEXT FK`
- `index INTEGER NOT NULL` (0..N)
- `title TEXT NULL`
~~- `first_turn_id TEXT FK -> turns.id NOT NULL`~~
- `summary TEXT NULL`
- timestamps

#### `intents`

- `id TEXT PK`
- `scenario_id TEXT FK -> scenarios.id NOT NULL`
- ~~`anchor_turn_id TEXT FK -> turns.id NOT NULL`~~
- `kind TEXT CHECK in ('manual_control', 'guided_control', 'narrative_constraint', 'continue_story', ...)`
- `status TEXT CHECK in ('pending','applied','cancelled','failed') DEFAULT 'pending'`
- `target_participant_id TEXT FK -> scenario_participants.id`
- `parameters TEXT NOT NULL
~~- `branch_policy TEXT CHECK in ('mainline','new_branch','replace_leaf') DEFAULT 'mainline'`~~
- timestamps

#### `intent_effects`

- `id TEXT PK`
- `intent_id TEXT FK -> intents.id NOT NULL`
- `turn_id TEXT FK -> turns.id`
- `kind TEXT CHECK in ('insert_turn','generate_turn','timeline_event')`
- `sequence INTEGER NOT NULL`
- **PK** `(intent_id, sequence)`

> (Eventually) `generation_runs` for observability; leave stubbed for now.

---

## Read models

1. **`getScenarioEnvironment(scenarioId)`**

- scenario (id, title, currentTurnId), participants (+characterId), characters (id, name, avatar), all chapters (id, index, title, firstTurnId).

2. **`getTimelineWindow({ anchorLeafId, leafTurnId, windowSize, layer })`**

- Recursive CTE: build `anchor` (anchorLeafId→root) to compute `anchorTotalDepth` and per-id `depthFromAnchor`.
- Build `page` (leafTurnId→root), join siblings (prev/next, count, index).
- Slice `LIMIT windowSize` (leaf→root), then order **depth DESC** (root→leaf).
- Compute `nextLeafId = top.parent_turn_id ?? null`.
- Compute `chapterTurnNumber` using the join to anchor and the chapter’s `first_turn_id` depth (grab once; reuse).

3. *(Optional for badges now or later)* **`getIntentProvenanceForTurns(turnIds[])`**

- Map `turnId -> { intentId, mode, … }` from `intent_effects` + `intents`.

---

## Transactional writes

1. **`IntentService.createAndStart(params)`**
   - Get `WorkflowRunnerManager` singleton, then get the runner for `turn_generation` workflows
   - Get `IntentRunManager` singleton
   - Insert `pending` intent into DB, commit
   - Make saga for the selected intent kind
     - Saga will yield effect generators:
       - Manual control: insert turn (player input text) -> choose actor -> generate turn -> insert turn
       - Guided control: generate turn -> insert turn
       - Narrative constraint: generate turn (narrator) -> insert turn -> choose actor -> generate turn
     - Effect generators 
2. **`advanceTurn(params)`** *(low-level creator used by the stub above)*
   - Insert turn under a parent, maintain `sibling_order`, inherit `chapter_id` unless overridden.
3. **`startNewChapter(scenarioId, title?)`**
   - Read `scenario.current_turn_id`, create chapter with `first_turn_id` at that leaf, `index = max(index)+1`.

---

## Routers (tRPC)

- `play.environment` → `getScenarioEnvironment`
- `play.timeline` → `getTimelineWindow`
- `play.createIntent` → `createIntent`
- `play.intentProgress` → async generator yielding events from turn engine (stubbed for now)
- `play.intentResult` → load `intent` + `intent_effects`, plus updated `scenario.current_turn_id`

---

## Engine modules to stub

- **`engine/turns/mock-effect-writer.ts`**
  `renderMockTurn({ mode, text, selectedCharacterName }) => string` (does not call LLM, just returns a test string).

---

## Frontend wiring (minimum)

- **Bootstrap on mount:** keep result in React Query, expose via `useScenarioCtx`
- **Timeline list:** `useInfiniteQuery({ initialPageParam: anchorLeafId, getNextPageParam: nextLeafId })`; flatten and dedupe by `turn.id`.
- **Input panel:** POST `intent`, then subscribe to `play.intentProgress` for updates; invalidate timeline with new `anchorTurnId`.
