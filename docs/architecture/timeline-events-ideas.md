# Timeline Events Concept Notes

## Purpose
This document summarizes the high-level ideas behind the "timeline events" system, prior to implementation.

## What Are Timeline Events?
Timeline events are narrative happenings that sit alongside turns in StoryForge's branching history. They modify long-lived state—chapters, scenes, character stats, inventories—without necessarily producing player-facing prose. Events are chronologically ordered artifacts that, when replayed along a timeline path, describe the evolving state of the scenario.

Key traits:
- They share timeline semantics with turns (they belong to a scenario, occur at a point in the turn tree, and can branch).
- They are not free-floating; every event is associated with a specific turn so we only need one graph structure.
- They are produced via intent effects, just like turns, making them part of the same provenance ledger.

## Event Lifecycle
1. **Intent or Tooling Creates an Event**: A player action (or automated tool) emits a `new_timeline_event` effect alongside, or instead of, `new_turn` effects.
2. **Event Attaches to a Turn**: The event records the turn that established the state change. This keeps the turn tree as the single chronological backbone.
3. **Branching Works the Same Way**: If an event is created on an alternate branch, its mutations only apply when that branch is active, because state derivation follows the currently selected path.
4. **State Derivation**: Scenario state at any moment is recovered by reducing events along the active path (root → anchor). This reduction yields the current chapter, scene, character stats, inventories, goals, etc.

## Event Categories (Initial Sketch)
- **Chapter Boundary**: Marks the end of a chapter while carrying metadata for the next chapter title and a summary of preceding turns.
- **Scenario Mutation**: Captures shifts in the environment (location, atmosphere, active scene flags).
- **Character Mutation**: Tracks updates to goals, secrets, stats, inventory, or other narrative properties. The long-term vision is to support flexible parameters (numeric) and collections (sets/lists).

Future versions may let agents invoke specialized tools to create these mutations autonomously. For example, a narrator agent could drop a scenario mutation to signal a scene change; a character agent could update its own inventory or goal list.

## Relationship to Turns & Effects
- Events coexist with turns by sharing the effect ledger. The original intent-effect schema already hints at a `new_timeline_event` kind alongside `new_turn`, so extending the ledger preserves ordering and provenance.
- Because every event references a turn, we avoid maintaining two parallel graphs and the invariants that would come with them.
- The same anchoring rules apply: switching timelines or deleting turns must consider any events anchored there, since the derived state depends on them.

## State Reduction & Snapshots
Replaying every event from the root to compute current state could become expensive. The long-term plan includes snapshotting derived state at strategic points (e.g., per chapter boundary) and applying only incremental events on top. Snapshots remain an optimization detail; the conceptual model is still "reduce events along the active path".

## Tooling & Autonomy
The envisioned system exposes new tools to the generative agents:
- Narrator tools for chapter and scene management.
- Character tools for manipulating stats, inventories, or personal arcs.
- Player-facing controls to override or author events directly.

Because events are captured as effects, these tools automatically benefit from existing observability channels (intent event streams, generation run recorder, etc.).

## Open Questions for Future Design
- How should events be serialized in timeline queries? (Inline with turns versus dedicated feed.)
- What minimal schema supports the chapter/scenario/character mutations without locking us into a rigid structure?
- How should UI surfaces present and edit events while keeping timeline browsing frictionless?
- Where should snapshots live, and what invalidates them when branches diverge?
