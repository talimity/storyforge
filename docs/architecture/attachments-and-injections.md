# Attachments & Injection Pass

## Purpose
Attachments let workflows reserve space for dynamically injected content that would be awkward or
impossible to express inside a template’s linear plan. The injection pass executes after the core
layout has been rendered, giving us a deterministic way to insert lore, chapter separators, and other
structural hints around anchor points while still honoring token budgets.

## Key Building Blocks
- **Attachment lanes**: Named channels (e.g., `lore`, `chapter_separators`) with default templates,
  message roles, ordering, and optional budget floors. Tasks can provide defaults; templates may
  override or extend them.
- **Lane groups**: Optional group descriptors that share wrapper templates and roles between related
  injections. Groups enable open/close wrappers around a cluster of injected messages without
  repeating boilerplate in every request.
- **Anchors**: Zero-width markers emitted during slot execution (`turn_{{item.turnNo}}`,
  `timeline_start`, etc.). Injection targets resolve to these anchors and survive budget trimming.
- **Injection requests**: Runtime instructions produced by attachment builders. Each request names a
  lane, optional group, priority, payload, and target anchor sequence.

## Rendering Lifecycle
1. **Layout and slot execution** produce the base message list plus anchor metadata. Templates remain
   unaware of attachments; they simply expose anchors via plan nodes.
2. **Attachment collection** merges task defaults, template overrides, and runtime requests. Each
   lane can define a reserved token floor so high-priority injections do not starve.
3. **Injection pass** (implemented in `runInjectionPass`) iterates lanes ordered by `lane.order`.
   Within a lane, requests are sorted by priority then submission order. For each request the pass:
   - Resolves the target anchor index, skipping the injection if the anchor was trimmed.
   - Chooses the highest-precedence template (request > group > lane) and renders content using the
     shared context and payload.
   - Verifies the message fits inside the current budget and consumes the estimate.
   - Inserts group wrappers (`openTemplate` / `closeTemplate`) on demand, tracking indices so wrappers
     end up adjacent to emitted messages.
   - Releases any unused reserved tokens when all lane requests are processed.
4. **Post-processing** sees a single, ordered message array even though injections were computed out
   of order relative to original plan execution.

## Budget & Ordering Guarantees
- Attachment lanes run after the layout budget has been decremented, so injections cannot retroactively
  push layout messages out of budget.
- Lane floors are enforced per lane. If no requests consume a floor, the budget manager releases it
  back to the global pool.
- Injected messages inherit their role from the request, group, or lane (in that priority order),
  keeping voice consistent without duplicating templates.
- Groups are optional; when used they ensure wrapper messages appear immediately before/after the
  injected content regardless of anchoring.

## Authoring Guidance
- Emit anchors in templates wherever attachments might need to hook content. Personalized names like
  `turn_{{item.turnNo}}_before` are deterministic and easy to target.
- Keep lane templates short and declarative. Runtime payloads should supply the dynamic bits.
- Prefer smaller payloads over large string concatenation inside templates; the leaf compiler skips
  injections that render empty strings, so conditional sections should stay inside handlebars logic.
- When combining multiple attachment systems, merge `attachmentDefaults` using lane ids so defaults
  do not overwrite one another.

## Example: Chapter Separators
The chapter separator builder inspects the rendered turn list and emits injection requests before the
first turn of each chapter. Titles come from saved summaries when they exist, otherwise the builder
falls back to derived chapter metadata added to every narrative context. The result is a consistent
visual boundary between chapters even when summarization has not yet been run.
