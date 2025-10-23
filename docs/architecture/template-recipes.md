# Template Recipe System

## Purpose
Template recipes give authors a guided way to configure prompt slots in the UI without exposing the full prompt DSL. Each recipe corresponds to a use case (timeline history, character roster, next-turn intent, etc.) and produces a ready-to-use `SlotSpec` when the user adjusts a handful of parameters. This keeps the builder approachable while still emitting prompt-rendering structures compatible with `@storyforge/prompt-rendering`.

## Core Building Blocks
- **RecipeDefinition** (`apps/frontend/src/features/template-builder/types.ts`):
  - Identifies the recipe (`id`, `name`, `task`, optional description).
  - Declares a set of typed UI parameters (`RecipeParamSpec`) with default values, min/max bounds, select options, help text, and tooltips.
  - Optionally lists available template variables so editors know which fields exist (e.g., `item.turnNo`).
  - Implements `toSlotSpec(params)` which converts sanitized parameter values into an `Omit<SlotSpec, "priority">` compatible with the prompt DSL.

- **Parameter inference** (`InferRecipeParams`): uses literal `parameters` arrays so TypeScript can infer the value type for each parameter key. The template builder components read these specs to render matching controls (number input, toggle, select, template string editor) and enforce constraints before invoking `toSlotSpec`.

- **Recipes by task kind**: The frontend organizes recipe files by task (`services/recipes/turngen/*` for turn generation). Each recipe imports the task’s `SourceSpec` (e.g., `TurnGenSources`) to ensure the generated SlotSpec uses valid DataRefs.

- **Slot Drafts**: When a user drops a recipe onto a slot, the UI stores a `SlotDraft` containing the recipe ID, current parameter values, and derived budget. Serialization as JSON lets drafts persist across sessions and rehydrate into real SlotSpecs when saving.

## Example Recipes (Turn Generation)
1. **Timeline (Simple)** (`timelineBasicRecipe`):
   - Parameters: turn template string, max turns, token budget.
   - Produces a single `forEach` plan over the `turns` source (newest first, `fillDir=prepend` so output is chronological). Each iteration emits a `user` message based on `turnTemplate` and appends an anchor keyed `turn_{{item.turnNo}}` so attachments can target specific turns.
   - Emits top/bottom anchors (`timeline_start`, `timeline_end`) around the loop so injections have deterministic boundaries even when turns are truncated by budgets. Additional header/footer anchors exposed by slot wrappers make it easy to inject guidance before or after the recipe's structural framing.
   - Variables advertised to the user (`item.turnNo`, `item.authorName`, etc.) map to properties the backend adds to timeline turn DTOs.

2. **Timeline (Advanced)**:
   - Adds templates for intent guidance, assistant responses, manual turns, toggles for unguided turns, plus the simple parameters.
   - Emits nested `if` plan nodes: checks whether the turn has intent metadata, whether it was manual control, and selects user/assistant template pairs accordingly. Uses reserved sources (`$item`, `$ctx`, `$globals`) to access intent kinds and narrator flags.
   - Adds the same anchor strategy as the simple variant (`timeline_start`, `turn_{{item.turnNo}}`, `timeline_end`) so lore/attachment lanes can place content relative to individual turns or the history boundary.

3. **Character Descriptions**:
   - Parameters: max characters, message role, character template, per-slot budget.
   - Iterates the `characters` source, skipping entries without descriptions, and emits messages under the user-selected role with the template string.
   - Declares anchors `character_definitions_start` / `character_definitions_end` around the loop, allowing attachments to inject lore before or after the roster without templates having to add bespoke slots.

4. **Next Turn Intent**:
   - Parameters: intent template, narrator extra prompt.
   - Emits user-facing guidance only when `currentIntent` exists and is not manual control. Appends narrator-specific instruction when the global flag indicates a narrator turn.

## Parameter Handling & Validation
- Number controls automatically clamp to `[min, max]` and default if left blank.
- Toggle and select options coerce to boolean or enumerated values.
- Template string parameters feed into Monaco/textarea editors with variable hints sourced from `availableVariables`.
- Since recipes return `SlotSpec` objects, generated structures are immediately compatible with the prompt compiler—no additional UI-to-DSL translation is necessary.

## Integration with Prompt Builder
1. User picks a task (e.g., turn generation) and adds slots to a template. Slots default to recipe-backed mode.
2. Selecting a recipe populates the parameter form. As users tweak values, the UI recalculates the `SlotSpec` preview by calling `toSlotSpec` with sanitized parameters.
3. When saving the template draft, the builder collects all slots: recipe-backed slots call `toSlotSpec`; custom slots store a raw JSON spec.
4. The resulting template draft is persisted in the builder’s local state and, when published, is sent to the backend template service where it undergoes full prompt compilation and validation.

## Design Motivations & Extension Points
- **Shield users from DSL complexity**: Most authors can assemble effective prompts using a few sliders and template strings. They only drop to raw SlotSpecs when necessary.
- **Type-safe UI**: Declaring parameters as const arrays gives compile-time safety. Editing a parameter name or type forces updates across the UI and recipe implementation.
- **Task isolation**: Recipes import their task’s `SourceSpec`, preventing invalid DataRefs from being generated.
- **Composable plans**: Recipes can mix plan nodes (`forEach`, nested `if`, multiple message roles) without duplicating validation logic, thanks to the shared `SlotSpec` shape.
- **Future growth**: Additional recipes (chapter summarization, writing assistant) can mirror this pattern. Long-term tooling (e.g., variable autocomplete, preview rendering) can rely on `availableVariables` and generated SlotSpecs without parsing raw DSL.

By coupling constrained parameter UIs with code-generated SlotSpecs, the recipe system offers a middle ground between a rigid canned prompt and the full flexibility of the DSL, keeping template authoring efficient and approachable.
