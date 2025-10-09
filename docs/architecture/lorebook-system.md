# Lorebook System Architecture

This document describes how StoryForge models, persists, and activates lore content during turn generation. Lorebooks provide structured narrative snippets that can be selectively injected into prompts based on recent story context. The system is designed to support manual scenario-wide books, character-linked books that follow participants automatically, and per-scenario overrides that keep inherited content under player control.

## Conceptual Overview

- **Lorebook**: A collection of keyed entries that describe facts, backstory, or rules. Each entry defines activation criteria (keywords, regexes, recursive depth, etc.) and insertion metadata (position, priority).
- **Manual assignment**: A lorebook explicitly added to a scenario by the player. Manual books always belong to the scenario and can be enabled or disabled globally.
- **Character-linked assignment**: A lorebook linked to a character through `character_lorebooks`. When a character participates in a scenario, their linked books become available automatically.
- **Override**: A per-scenario switch that changes whether a character-derived book is active for that scenario. Overrides are optional and only persist when the player diverges from the default behavior.
- **Activation**: The runtime process that inspects recent turns, matches entry triggers, and produces the concrete text segments included in a turn-generation prompt.

The system separates **sources** (manual vs inherited) from **state** (current enabled flag) so that derived books never require manual synchronization and can be toggled without mutating shared linkage tables.

## Data Model

| Table | Purpose | Key Columns |
| --- | --- | --- |
| `lorebooks` | Canonical lorebook definition (name, normalized data, metadata) | `id`, `data`, `entry_count`, `fingerprint`, `source` |
| `character_lorebooks` | Links a lorebook to a character so it can follow them into scenarios | `character_id`, `lorebook_id` (unique pair) |
| `scenario_lorebooks` | Manual scenario assignments with an enabled flag | `scenario_id`, `lorebook_id`, `enabled` |
| `scenario_character_lorebook_overrides` | Optional per-scenario override for inherited character books | `scenario_id`, `character_lorebook_id`, `enabled` |

Additional supporting tables provide participant status and timeline context:

- `scenario_participants` tracks which characters are active in a scenario and whether they are currently in play (status `active` vs `inactive`).
- Turn data and intent records feed the activation pipeline but are orthogonal to storage.

### Normalization Rules

- Manual and character-linked sources never share storage. Manual books live in `scenario_lorebooks`; character books remain in `character_lorebooks`.
- Overrides reference the `character_lorebooks` row so cascading deletes work automatically (removing the link deletes related overrides).
- The unique constraint on `(scenario_id, character_lorebook_id)` prevents duplicate overrides for the same inherited book.

## Lifecycle & Workflows

### Authoring Lorebooks

1. **Creation/Import**: Players create lorebooks via the backend `LorebookService`. Normalization ensures consistent structure, deduplicates by fingerprint, and computes `entry_count`.
2. **Linking to Characters**: When a character imports or generates a lorebook (e.g., from a Tavern card), `linkLorebookToCharacter` inserts the row into `character_lorebooks`. Existing links are idempotent.

### Managing Scenario Assignments

The `ScenarioService` orchestrates assignment composition when scenarios are created or updated:

1. Collect participant snapshots (only active character participants are considered).
2. Combine three sources into a unified list:
   - Manual assignments requested in the scenario form.
   - Existing manual rows already stored for the scenario.
   - Character links for active participants.
3. Persist results with `LorebookService.replaceScenarioLorebookSettings`:
   - Manual entries are synchronized with `scenario_lorebooks` (insert/update/delete minimal rows).
   - Required overrides are stored in `scenario_character_lorebook_overrides` only when the enabled state deviates from the default (active-by-default for active participants).

When participants change (added, removed, or status updated), the service recomputes assignments so inherited books reflect the new roster automatically.

### Frontend Interaction Model

- **Scenario editor**: The `ScenarioLorebookManager` separates manual vs inherited sections. Manual entries can be added via a selector, toggled, or removed. Inherited entries show the originating character and toggle state; flipping the switch stores an override only if it differs from the default. Client state mirrors the backend schema (`kind: "manual" | "character"`).
- **Scenario create/update mutations**: Forms serialize lorebooks into assignment payloads using `serializeLorebookAssignments`, emitting manual entries and explicit overrides only when needed.
- **Character link UI**: Character detail views can attach or detach lorebooks, affecting future scenarios without touching existing scenario rows.

## Runtime Activation Pipeline

Turn generation uses the `IntentContextBuilder` and lorebook scanner to prepare prompt context:

1. **Load Assignments**: `loadScenarioLorebookAssignments` composes manual and character-derived assignments for the scenario:
   - Manual rows include `enabled` and `defaultEnabled` (same value).
   - Character rows derive `defaultEnabled` from participant status (`active` ⇒ true, `inactive` ⇒ false) and apply overrides if present.
   - Each assignment specifies `kind`, `lorebookId`, optional `characterId`, and normalized lorebook data.
2. **Scan Turns**: The scanner (`scanLorebooks`) walks assignments in deterministic order (manual before character, alphabetical within groups), evaluates entry triggers against recent turns, and respects recursive scanning budgets.
3. **Produce Prompt Segments**: Activated entries are grouped by insertion position (`before_char`, `after_char`) and passed to prompt templates. Debug APIs (`lorebooks.activated`, `lorebooks.activatedSummary`) expose the same evaluation results for inspection.

#### Default & Override Semantics

- Manual entries honor the stored `enabled` flag directly.
- Character entries enable automatically when the participant is active and no override exists.
- Overrides set `enabled` to the stored value (`true` or `false`). Removing an override reverts to the participant-derived default.
- Inactive participants force inherited books off regardless of overrides, ensuring deactivated characters do not leak lore.

## Extension Points & Future Considerations

- **Actor-specific activation**: With overrides separated, it is straightforward to gate character-derived entries by current actor (e.g., only use when it is that character's turn).
- **Granular overrides**: The override table can be extended with additional columns (priority, notes) without touching manual assignments.
- **Scenario states**: If participants gain more status values (e.g., temporarily unavailable), default enable derivation can be adjusted centrally in the loader.
