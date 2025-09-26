# Scenario Timeline & Player Intents

Describes the model for the Timeline and Player Intent systems.

Note: any code or types are illustrative, only the concepts are important.

## Definitions

- **Scenario:** a story world with participants, characters, chapters, and turns.
- **Participant:** an entity in the scenario; can be the narrator or a character from user's Library.
- **Character:** a persona with name, avatar, and SillyTavern v2 data; linked to a participant.
- **Turn:** a diegetic narrative unit authored by a participant. Each turn might have multiple content layers.
- **Layer:** a specific view of a turn's content, e.g., "presentation" for prose shown to player, "planning" for LLM
  agents' reasoning, etc.
    - **`presentation` layer:** default layer for player-facing content. Always present; other layers depend on agent
      configuration.
- **Chapter:** a narrative boundary within the scenario, grouping turns together. Functions as both player-facing label
  and a boundary for LLM summarization to reduce context size.
- **Swipes:** named after Character.ai swipe feature which allows players to swipe away turns they don't like. In this
  context, it refers to branches in the timeline.
    - Siblings/swipes are always alternate takes on the same situation (the parent turn).
- **Turn Graph:** a rooted tree structure of turns, where each turn can have multiple children (swipes) and a single
  parent.
- **Timeline:** a path from scenario root `r` to some leaf turn `l`, representing a continuous narrative flow.
    - **Root turn:** the first turn in the scenario, from which all timelines start.
    - **Leaf turn:** a turn with no children, representing the end of one narrative branch.
    - **Anchor turn:** the leaf turn for the branch currently being played by the user. It represents the current state
      of the scenario.
    - **Active timeline:** the path from `r` to anchor turn `a`; the timeline that is displayed in the main UI and used
      to build prompts for LLM agents.
- **Intent:** a non-diegetic record of player input, which leads to one or more turns being generated. It can be a
  direct control action, a story constraint, or a quick action.
- **Intent effect:** the mapping of an intent to the turns it caused, with a sequence number indicating the order of
  effects.

v0++ concepts:

- **Timeline events**: Narrative progression events that are not turns, but have similar chronological semantics.
    - Such as...
        - **Chapter boundary:** denotes the end of a chapter; carries the name of the *next* chapter and the summary of
          all turns until the previous boundary.
        - **Scenario mutation:** change of scene, 'atmosphere', etc.
        - **Character mutation:** character goal updates, secrets revealed, stat/inventory/etc. changes.
            - (eventually) stats and inventory are probably generic; a player could define 'parameters' (numeric, for
              tracking arbitrary attributes, currency, "sanity", whatever) or 'collections' (sets, for tracking items,
              skills, equipped gear, etc)
    - (eventually) we could expose tool calls to let models autonomously apply scenario or chapter mutations; narrator
      agent could invoke scene changes, character agents can update parameters and collections autonomously
    - Because a scenario is a tree, timeline events can't be simple scalars in the DB; the current value of a
      character's inventory or goals list, or the current scene, must be derived by reducing events along the
      current timeline.
    - For performance, we might need a snapshot system.
    - We don't want to keep a separate graph for events and have to maintain cross-graph invariants. Instead, each
      timeline event must be associated with a turn. They are created by intent effects.

## Decisions

### Timeline API

- **Paging model:** Timeline is stored as an adjacency list where each turn stores its parent. Each page asks for
  `leafTurnId`, returns a window up toward the root (root→leaf order), plus `cursors.nextLeafId` (the parent of the top
  row) or `null` if you hit root.
- **Window size:** `windowSize` (e.g., 12) is the number of turns to return, starting from the leaf turn. The server
  computes the slice from the leaf up to the root.
- **Turn content:** timeline API returns one layer only (default `"presentation"`).
- **Swipes:** include prev/next sibling ids `swipeCount` + `swipeNo` (1-based) for each turn. Allows UI to hint at
  alternate branches without loading all branches.
- **Numbering:** turn numbers derived by server by traversing the tree from the leaf up to the root. Each turn has a
  `turnNo` (1-based relative to root) for UI display.
- **Skinny timeline DTO:** timeline API returns only ids + turn text content + metadata. Actual
  participants/characters/chapters are loaded once via `play.environment` procedure and cached client‑side, rather than
  every timeline turn object duplicating the same character names, avatars, etc. data.

### Intents & effects

- **Intent** is the player input (mode, text, knobs). It’s not a turn or layer.
- Kicking off an **intent run** selects an *executor* for the intent kind, which is a generator function that runs one
  or more *commands*.
    - Direct Control: `insertTurn` command with player's input, verbatim; `chooseActor` command; `generateTurn` command
      for selected actor
    - Narrative Constraint: `generateTurn` command for narrator; `insertTurn` with generation output; `chooseActor`;
      `generateTurn` for selected actor; `insertTurn` with generation output
- **Intent effects** map an intent → the turn(s) it caused (`sequence` 0..N). Each `insertTurn` triggers a `new_turn`
  effect. In the future, timeline events could possibly be effects too.

### Bootstrapping & UI data strategy

- On entering the player, call **`/api/play/environment`** to fetch scenario, participants (+characters), and
  eventually, the fully derived chapter/timeline events state for the current timeline.
- Timeline calls only return ids, turn numbers, and requested content; UI maps names/avatars from store.
- React Query `useInfiniteQuery` with `pageParam = leafTurnId` and `getNextPageParam = nextLeafId`.

## Sqlite schema approximation

### `turns`

- `id TEXT PK`
- `scenario_id TEXT FK`
- `parent_turn_id TEXT FK -> turns.id NULL`
- `author_participant_id TEXT FK`
- `sibling_order TEXT NOT NULL` (lexorank-ish)

Turn text content is stored in a separate table, `turn_layers`.

### `intents`

- `id TEXT PK`
- `scenario_id TEXT FK -> scenarios.id NOT NULL`
- ~~`anchor_turn_id TEXT FK -> turns.id NOT NULL`~~
- `kind TEXT CHECK in ('manual_control', 'guided_control', 'narrative_constraint', 'continue_story', ...)`
- `status TEXT CHECK in ('pending','applied','cancelled','failed') DEFAULT 'pending'`
- `target_participant_id TEXT FK -> scenario_participants.id`
- `input_text TEXT`
- ~~`branch_policy TEXT CHECK in ('mainline','new_branch','replace_leaf') DEFAULT 'mainline'`~~

### `intent_effects`

- `intent_id TEXT FK -> intents.id NOT NULL`
- `sequence INTEGER NOT NULL`
- `turn_id TEXT FK -> turns.id`
- (eventually) `timeline_event_id TEXT FK -> timeline_events.id`
- `kind TEXT CHECK in ('new_turn', 'new_timeline_event')`
- **PK** `(intent_id, sequence)`

> (eventually) something like `generation_runs` for observability

## Queries

1. **`getScenarioEnvironment(scenarioId)`**
- scenario (id, title, currentTurnId), participants (+characterId), characters (id, name, avatar)

2. **`getTimelineWindow({ anchorLeafId, leafTurnId, windowSize, layer })`**
- Recursive CTE: build `anchor` (anchorLeafId→root) to compute `anchorTotalDepth` and per-id `depthFromAnchor`.
- Build `page` (leafTurnId→root), join siblings (prev/next, count, index).
- Slice `LIMIT windowSize` (leaf→root), then order **depth DESC** (root→leaf).
    - Compute `nextLeafId = top.parent_turn_id ?? null`.

## Services (sketch)

1. **`IntentService.createAndStart(params)`**
- Get `WorkflowRunnerManager` singleton, then get the runner for `turn_generation` workflows
- Get `IntentRunManager` singleton
- Insert `pending` intent into DB, commit
- Get executor for the selected intent kind
    - Generator will yield commands, which run workflows and apply side effects
        - Manual control: insert turn (player input text) -> choose actor -> generate turn -> insert turn
        - Guided control: generate turn -> insert turn
        - Narrative constraint: generate turn (narrator) -> insert turn -> choose actor -> generate turn
2. **`TimelineService.advanceTurn(params)`**
    - Insert turn under a parent, maintain `sibling_order`, inherit `chapter_id` unless overridden.

## tRPC Routers
- `play.environment` → `getScenarioEnvironment`
- `play.timeline` → `getTimelineWindow`
- `play.createIntent` → `createIntent`
- `play.intentProgress` → async generator yielding events from turn engine (stubbed for now)
- `play.intentResult` → load `intent` + `intent_effects`, plus updated `scenario.current_turn_id`
