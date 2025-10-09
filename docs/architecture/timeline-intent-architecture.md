# StoryForge Timeline & Intent Architecture

## Purpose
This document captures the mental model behind the timeline and intent systems and how they handle branching narratives, player input (intent) execution, and generation workflows.

## Conceptual Overview
- **Scenario**: the container for everything else. Each scenario has a roster of participants, a rooted turn tree, and a pointer to the active timeline.
- **Participant**: a narrator or character that can author turns. Participants mirror scenario membership and carry ordering metadata used for rotation.
- **Turn**: a node in the scenario's turn tree. Turns hold layered content ("presentation" prose, hidden reasoning, etc.) and link back to their author.
- **Ghost turn**: a turn flagged as inactive. Ghosts stay in the graph (and keep their numbering and children) but are skipped when deriving timeline state or rendering prompts.
- **Timeline**: any root→leaf path through the turn tree. The **anchor** is the leaf that defines the active timeline; it always resolves to an actual leaf node, never an interior point.
- **Intent**: a player action that may lead to one or more new turns. Intents own execution state, branching instructions, and the provenance trail that links back to the turns they spawned.
- **Effect**: a durable record tying an intent to the structural change it caused (currently new turns). Effects provide the glue between the intent ledger, the turn graph, and observability tooling.

These concepts are deliberately decoupled: intents orchestrate mutations but never embed structural knowledge; the timeline service enforces graph invariants but does not care why an operation was requested; workflows focus on text generation and emit telemetry without knowing about database layouts.

## Turn Graph & Timeline Invariants
### Structure and Ordering
Turns form a rooted tree stored as an adjacency list. Each turn knows its parent (root turns omit the parent) and carries a lexicographic `sibling_order` rank. Ranks make branch creation and reordering cheap without reindexing siblings. A scenario enforces exactly one root turn, and every turn belongs to exactly one scenario.

### Active Timeline & Anchor
The anchor identifies the current playthrough. Any operation that inserts a new turn as part of the active run updates the anchor to that new leaf. When switching anchors (for example after previewing an alternate branch), the system resolves the requested node into its deepest descendant before committing, guaranteeing the anchor is always a true leaf. Deletions also honor this rule: if the anchor is removed, the service promotes a sensible replacement (either the parent or, when promoting children, the leftmost surviving child).

### Branches (“Swipes”)
Branching is intent-agnostic. An intent may request that its first structural change start from an earlier turn, creating a sibling branch under that parent. The system distinguishes between two branch origins:
- **Turn parent**: retry a beat by branching from the parent of an existing turn.
- **Intent start**: replay an earlier intent sequence by branching from the parent of the first turn that intent created.

Branches can be explored without committing by asking for a timeline window rooted at an arbitrary leaf. Commitment simply updates the anchor after verifying the branch has no descendants. While an intent is running, anchor switches are blocked to avoid splitting an in-flight generation across timelines.

### Layered Turn Content
Turn content is stored per layer so that reasoning traces, drafts, or alternative renderings can coexist with the player-facing prose. Every turn must include a `presentation` layer. Additional layers can be updated independently without touching the graph, which keeps narrative edits orthogonal to structural mutations.

### Timeline Queries
The timeline window query treats the turn tree as a path defined by a leaf and walks toward the root, slicing a window for paging. Results are returned in chronological order (root→leaf) and include:
- Turn metadata (author, timestamps, turn number within the path).
- Swipe hints (left/right siblings, swipe count/index) so the UI can surface alternates lazily.
- Content for the requested layer.
- Intent provenance baked into each row (intent id, kind, status, original input) sourced from the effect ledger.

This query powers both infinite scrolling in the active timeline and branch previews when the client supplies a different leaf.

### Mutations Beyond Insertion
- **Advance / branch**: wraps validation (participant must belong to the scenario and be active, layers must be well-formed), computes the correct parent (anchor by default, or a branch point), inserts the turn, updates sibling ranking, and moves the anchor.
- **Deletion**: plans either a cascade (remove a subtree) or promotion (adopt children into the parent's slot). Anchor adjustments are part of the plan, and promotion re-ranks children into the surrounding order band.
- **Content edits**: isolated to per-layer updates and do not influence structure; they are safe to apply while other timeline operations are happening, because layer records are separate from the turn tree.

## Intent Engine
### Lifecycle and Status
Intents progress through `pending → running → finished` (or `failed/cancelled`). A scenario may have at most one intent in a non-terminal state. Pending intents store enough information to resume execution if the process restarts before the generator spins up.

### Executors and Command Pipeline
Each intent kind maps to an **executor**, implemented as an async generator over high-level **commands**:
- `generateTurn`: orchestrates a workflow run, streams progress tokens, and yields telemetry events while buffering the final prose.
- `insertTurn`: commits a new turn (respecting branch origin for the first insertion) and records a matching effect. The intent ledger uses the effect sequence to preserve ordering when multiple turns are produced.
- `chooseActor`: performs a fairness-aware round robin over eligible participants along the relevant timeline path. In the future, this may invoke a workflow to select the next actor.

Executors compose these primitives to express behaviors:
- **Manual control**: player authors a turn for a chosen participant, then the system picks a follow-up actor and generates a reply without constraints.
- **Guided control**: generate a single turn with the player’s constraint baked into the context.
- **Narrative constraint**: narrator rationalizes the constraint, then the chosen actor continues.
- **Continue story**: pick the next actor automatically and generate an unconstrained turn.

Because the pipeline is generator-based, intents can interleave command outputs with progress events, and runtime services (like the event stream or telemetry recorder) can subscribe without blocking execution.

### Branch Origins in Execution
Executors receive an optional `branchFromTurnId`. They must hand that ID to the first structural command (`generateTurn` for context building and `insertTurn` for the matching insert). After the first insertion, subsequent commands naturally continue down the newly-created branch because the anchor now points there.

## Generation Workflow Integration
### Context Assembly
Before any generation step, the intent context builder gathers:
- The full active timeline (root→branch leaf) converted into a model-friendly DTO, including intent prompts for provenance.
- The roster of active characters with macro-expanded biographies and the narrator flag.
- Scenario metadata (name, description) and helper globals (next turn number, user proxy name).

This context bridges the gap between structural data and workflow templates without the templates needing to know about database schemas.

### Workflow Runner & Budgeting
A singleton workflow runner manager lazily instantiates runners per task kind. For turn generation it:
- Loads and binds the configured prompt template and model profile.
- Creates adapters for the target inference provider.
- Sets up token budgeting using the profile’s guidance (defaulting to a conservative budget when unspecified).

Generation runs therefore follow the recipe defined in the workflow registry while remaining agnostic to how callers sourced their context.

### Telemetry & Diagnostics
Every workflow event (step starts, prompt renders, captured outputs, errors) flows through the **Generation Run Recorder**. The recorder:
- Creates a generation run record when a workflow starts, capturing participant, branch origin, and timestamps.
- Logs each step’s metadata, prompts, and responses.
- Links the run to the turn once the matching effect is committed.
- Marks remaining runs as cancelled or errored if the intent fails or is interrupted.

This produces a searchable audit trail without coupling the pipeline to any particular logging backend.

## Effects, Provenance, and Event Streams
### Intent Effects Ledger
Each call to `insertTurn` appends a new effect with a monotonically increasing sequence number. Effects currently only model `new_turn`, but they intentionally mirror a more general "effect" vocabulary so that non-turn timeline events can be represented later without refactoring the ledger.

Effects serve multiple roles:
- They give the timeline window query a direct way to embed provenance in each row.
- They power branch retries by letting the system find the starting turn of a previous intent.
- They drive the intent result endpoint, which the UI polls after an intent finishes.

### Real-time Events
Intent execution feeds an **intent event stream** (fan-out via broadcast). Consumers—most notably the frontend—can subscribe to receive:
- Lifecycle markers (`intent_started`, `intent_finished`, `intent_failed`).
- Generation workflow telemetry (`gen_start`, `gen_token`, `gen_event`, `gen_finish`).
- Structural confirmations (`effect_committed`).
- Actor selection hints for visual feedback.

The stream replays prior events to late subscribers and terminates when the run ends, after which a retention timer eventually reclaims the run from memory.

## Client Interaction Patterns
### Bootstrapping the Player
1. Call the environment endpoint to retrieve scenario metadata, participant roster, and character stubs. The payload includes any in-flight intent so the UI can resume streaming if needed.
2. Prime the local cache of characters/participants; timeline rows reference them by id to avoid repetition.

### Viewing Timelines
- Use the timeline endpoint with `cursor = anchor` to page through the active path.
- Supply a different leaf cursor to preview an alternate branch; the server sanitizes the request to ensure the cursor lies on a single path.
- When the player commits to a branch, call the anchor-switch endpoint, which enforces the no-in-flight-intent guard and updates the anchor.

### Authoring Turns
- Creating an intent posts intent parameters plus optional branch origin. The backend allocates the intent, resolves the branch point, and starts the executor.
- The UI listens to the event stream for drafting feedback while also showing the "Draft Turn" placeholder.
- Once the intent completes, the client fetches results (including effect details) to reconcile state and may then refresh the timeline window to pick up the new turns.
- For quick manual edits (e.g., GM overrides), the player can call the "add turn" mutation, which invokes the same structural guarantees without the intent pipeline.
- Per-layer edits go through a dedicated endpoint and do not alter intent history.

### Cleaning Up
- Deleting turns offers cascade or promotion modes; the UI can use them to prune branches or tidy the active path. After deletion, refetching the timeline reflects the updated anchor and structure.
- Interrupting an intent triggers a cancellation signal; the executor halts, telemetry marks the run accordingly, and partial text (if any) is preserved in the failure event for potential recovery.

## Design Principles & Extension Points
- **Anchor-on-insert** keeps the "current story" definition simple and matches player expectations that the newest turn is now the live edge.
- **Effects as first-class records** let us attach future timeline events (inventory changes, chapter summaries) without changing the intent contract; they simply become new effect kinds.
- **Command/Executor separation** allows new intent kinds or automation recipes to compose existing primitives instead of rewriting control flow.
- **Layered content** keeps prose and metadata loosely coupled so tooling can add internal planning or model diagnostics without bloating the main timeline payload.
- **Path-based paging** sidesteps graph serialization complexity; consumers operate on linear slices and only pull sibling metadata when needed.
- **Guardrails on branching** (leaf resolution, single running intent, narrator fairness) ensure the timeline stays coherent even under aggressive experimentation.
- **Lorebook scanning** consumes the already-hydrated turn DTOs so it never re-queries the timeline graph; this makes it easy to extend activation rules (timeline events, cross-book recursion) without touching core timeline services.

Future additions—timeline events beyond turns, richer branch metadata, collaborative scenarios—can reuse these same foundations: intents declare *what* the player wants, commands describe *how* to realize it, and the timeline service enforces the structural truths that keep the story tree healthy.
