# StoryForge Timeline Events Architecture

## Purpose
This document explains the timeline events system: what qualifies as an event, how events stay in lockstep with the turn tree, and how downstream services consume derived state. It is intended to provide a mental model for contributors so they can reason about narrative mutations without digging into every module.

## System Overview
- **Events extend the timeline ledger.** They capture structural or long-lived state changes (chapter breaks, scene presence, etc.) that accompany turns without always emitting prose.
- **Turns remain the spine.** Each event is anchored to a specific turn and inherits all branching semantics from the turn tree, so no parallel graph or bespoke ordering rules are required.
- **State is derived, not stored.** Consumers reconstruct the current scenario state by reducing events along the active root→leaf path; snapshots are a future optimisation, not part of the conceptual model.
- **Concerns isolate responsibilities.** Each area of derived state (chapters, presence, future inventories) is implemented as an independent reducer that only handles the event kinds it understands.
- **Derived hints enrich DTOs.** Reducers can emit lightweight hints (e.g., computed chapter numbers) that decorate events when they are returned to clients or handed to generators.

## Event Model & Storage
- Events live in the `timeline_events` table. Key columns: `turn_id` anchor, `position` (`before`/`after` relative to the turn), and a lexicographic `order_key` that ensures deterministic ordering within the same turn+position slot.
- The table enforces that a turn and scenario match to avoid orphaned records. Cascading deletes keep events aligned with turn pruning.
- Event payloads are versioned JSON blobs. Each event kind owns a spec (`kind`, `latest` version, Zod schema, parser) that upgrades legacy payloads on read.
- Position and order let the system interleave multiple events with a single turn while permitting author-controlled ordering (e.g., presence changes before narrations).

## Derivation Pipeline
1. **Loader** (`TimelineEventLoader`) fetches events along a requested path. A single recursive SQL query walks from the selected leaf (default anchor) to the root and returns ordered events for those turns.
2. **State Deriver** (`TimelineStateDeriver`) parses raw rows via the event registry, normalising payloads and handing them to concern reducers.
3. **Concerns** reduce events sequentially, producing a `final` state object (one slice per concern) plus an optional `hints` map keyed by event id.
4. **Result** packages the ordered event list, derived final state, and hint lookup. No caching is performed yet; repeated calls recompute the reduction.

This pipeline is stateless and path-scoped: asking for a different leaf simply reruns the reduction for that branch without affecting other timelines.

## Concern Registry
- Concerns are registered in `timelineConcerns`, each declaring the event kinds they handle, an `initial` state factory, and a pure `step` reducer.
- Current concerns:
  - **Chapters** count chapter breaks and remember the last event, emitting hints with human-readable chapter numbers for prompts.
  - **Presence** maintains a map of participant presence flags so services can tell who is in the scene.
- Additional concerns (scene metadata, inventories, goals, secrets) can be added incrementally without touching existing reducers. Concerns never mutate each other’s state; they only read the shared event stream.

## Event Registry & Prompt Surface
- Event specs live alongside concerns and expose optional `toPrompt` formatters. These formatter hooks convert typed payloads plus concern hints into short, prompt-friendly strings (e.g., “Chapter 3 begins”).
- The helper `eventDTOsByTurn` groups events by turn and applies the formatter, producing DTOs split into `before`/`after` buckets. UI and generation contexts can therefore render structured event banners without reimplementing parsing.

## Integration Points
- **Timeline windows** enrich turn rows with associated events and derived prompts, letting clients render chapter boundaries or status pips inline with turns.
- **Intent context builder** includes the same event DTOs in the `TurnGenCtx`, giving prompt templates visibility into structural beats (active participants, recent chapter breaks) when drafting new turns.
- **Actor selection** consults the presence slice of the final state to exclude characters marked absent when computing the next speaker.
- **Back-end services** can call the state service directly to answer questions like “which chapter are we in?” without fetching all turns.

## Operational APIs
- The backend exposes explicit mutations for inserting and deleting events (chapter breaks, presence changes, scene sets).
- Event insertion defaults to the `after` slot of a turn but allows callers to place events `before` the prose when necessary, ensuring reproducible ordering for things like stage directions.
- Deletion simply removes the record; derived state naturally reflects the change on the next reduction pass because state is not cached.

## Branching & Anchor Semantics
- Because every event is tied to a turn, branching “just works.” Events on alternate branches stay isolated until that branch becomes the active anchor. Replaying a branch walks the inclusive root→leaf path for that branch and ignores sibling timelines.
- Switching the anchor or pruning turns automatically reuses the same derivation pipeline; no extra bookkeeping is needed to move or reassign events.
  - Derived properties, such as chapter numbers, will automatically be recomputed on the next derivation. A chapter break assigned to a turn that is moved up before another chapter break will receive a lower chapter number by the derivation pipeline.

## Extension Points & Open Questions
- **More concerns & specs:** Scene metadata, inventory mutations, and long-term goal tracking can plug into the existing registries as additional reducers once their schemas stabilise.
- **Snapshotting:** Current derivation is replay-only. Future snapshot caches (e.g., per chapter) can wrap the deriver without changing the caller contract.
- **Provenance:** Today events are inserted via service calls; long term they should be emitted as intent effects (`new_timeline_event`) alongside turns so the provenance ledger remains single-sourced.
- **Formatter data:** Presence prompts currently surface participant ids; richer payloads (names, reasons) may be embedded directly in event payloads to avoid extra lookups.
- **Visibility:** Event metadata may be extended to carry a visibility field which controls the visibility of that event to other participants, allowing for some events and derived state (goals, secrets, etc) to remain hidden from other participants in the scenario.

Keeping events anchored to turns, reduced through independent concerns, and surfaced via DTO helpers ensures the system stays modular: new event kinds can be introduced without disturbing existing consumers, and services can always reason about scenario state by replaying the path they care about.
