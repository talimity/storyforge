# Prompt Template Engine Specification - v1

**Scope:** This document defines the template DSL and the rendering algorithm that turns heterogeneous task inputs into a `ChatCompletionMessage[]` request.

## 1) Overview

* A **PromptTemplate** declares:

    1. **Slots** (what to **fill** and in what **priority** order with respect to token budget), and
    2. A **Layout** (how to **assemble** the final messages in display order).

* Rendering is **two-phase**:

    * **Phase A – Fill:** Consume a global token budget by filling slots in **priority** order (lowest numeric value first). Each slot has a plan that can iterate arrays, apply conditions, and emit messages.
    * **Phase B – Assemble:** Emit the final `ChatCompletionMessage[]` by walking the **layout** and inserting filled slot contents (with optional headers/footers).

* Templates may declare **response transforms** (e.g., regex extract/replace) to post-process the assistant’s text before capture.

* Micro-templating (e.g., Handlebars) is allowed **only inside leaf strings** (e.g., message `content`). The **structure** (ordering, iteration, budgeting) is declarative in the DSL.

---

## 2) Terminology

* **TaskKind:** The application’s task types, e.g., `'turn_generation' | 'chapter_summarization' | 'writing_assistant'`. A template is **authored for exactly one TaskKind**.

* **Task Render Context (per TaskKind):** Small, normalized DTOs required by that task. Examples (non-exhaustive):

  ```ts
  export type TurnGenCtx = {
    turns: TurnLite[];                 // already scoped (e.g., current chapter), normalized
    chapterSummaries: ChapterSummaryLite[];
    characters: CharacterLite[];
    currentIntent: { description: string; constraint?: string };
    stepInputs?: Record<string, unknown>;
    globals?: Record<string, unknown>;
  };

  export type WritingAssistantCtx = {
    userText: string;
    examples?: string[];
    stylePrefs?: Record<string, unknown>;
    stepInputs?: Record<string, unknown>;
    globals?: Record<string, unknown>;
  };

  export type ChapterSummCtx = {
    turns: TurnLite[];
    chapterSummaries: ChapterSummaryLite[];
    globals?: Record<string, unknown>;
  };
  ```

* **Source Registry (per TaskKind):** A pure, synchronous resolver used by the renderer to fulfill **DataRefs**. Each task defines which sources exist and how to resolve them from that task’s context.

* **Message:** `{ role: 'system'|'user'|'assistant', content: string, prefix?: boolean }`. If the final assistant message sets `prefix: true`, the caller must route to a model that supports assistant prefixing (enforced upstream).

* **Slot:** A named container that gets **filled** under budgets in **priority** order, then **inserted** at a layout position.

* **Plan:** A small sequence of nodes that, when evaluated, emits 0..N messages into a slot.

---

## 3) Type Definitions

(Note: check the latest TypeScript definitions in the prompt-renderer package for any updates as the implementation evolves.)

```ts
/** ---------- Task binding ---------- */

export type TaskKind =
  | 'turn_generation'
  | 'chapter_summarization'
  | 'writing_assistant';

export type TaskCtx<K extends TaskKind> =
  K extends 'turn_generation'       ? TurnGenCtx :
  K extends 'chapter_summarization' ? ChapterSummCtx :
  K extends 'writing_assistant'     ? WritingAssistantCtx :
  never;

export type TaskBoundTemplate<K extends TaskKind> = PromptTemplate & { task: K };

/** ---------- Template & Layout ---------- */

export type PromptTemplate = {
  id: string;
  name: string;
  version: number;
  layout: LayoutNode[];                  // display order
  slots: Record<string, SlotSpec>;       // fill order & logic
  responseFormat?: 'text' | { type: 'json_schema'; schema: object } | 'json';
  responseTransforms?: ResponseTransform[]; // optional output post-processing
};

export type LayoutNode =
  | { kind: 'message'; name?: string; role: ChatCompletonMessageRole; content?: string; from?: DataRef; prefix?: boolean }
  | { kind: 'slot'; name: string; header?: MessageBlock | MessageBlock[]; footer?: MessageBlock | MessageBlock[]; omitIfEmpty?: boolean }
  | { kind: 'separator'; text?: string };

export type MessageBlock = { role: ChatCompletonMessageRole; content?: string; from?: DataRef; prefix?: boolean };
export type ChatCompletonMessageRole = 'system' | 'user' | 'assistant';

/** ---------- DataRef via Source Registry ---------- */

export type DataRef = { source: string; args?: unknown };

/** ---------- Slots & Plans (Phase A) ---------- */

export type SlotSpec = {
  /** Lower number = higher priority (0 fills before 1). */
  priority: number;
  /** Optional condition to decide whether the slot should render at all. */
  when?: ConditionRef;
  /** Per-slot ceiling (in addition to the global budget). */
  budget?: Budget;
  /** Emits the slot’s candidate messages, evaluated under the slot+global budget. */
  plan: PlanNode[];
};

export type Budget = {
  /** Hard ceiling for this node/slot; renderer will stop before exceeding it. */
  maxTokens?: number;
  /** Soft target; renderer may stop around this value. (Advisory only.) */
  softTokens?: number;
};

export type PlanNode =
  | { kind: 'message'; role: ChatCompletonMessageRole; content?: string; from?: DataRef; prefix?: boolean; budget?: Budget }
  | { kind: 'forEach';
      source: DataRef;                   // must resolve to an array
      order?: 'asc'|'desc';
      limit?: number;
      map: PlanNode[];                   // evaluated with {item} in scope
      interleave?: { kind: 'separator'; text?: string };
      budget?: Budget;
      stopWhenOutOfBudget?: boolean }    // default: true
  | { kind: 'if'; when: ConditionRef; then: PlanNode[]; else?: PlanNode[] };

/** ---------- Conditions ---------- */

export type ConditionRef =
  | { type: 'exists'; ref: DataRef }
  | { type: 'nonEmpty'; ref: DataRef }
  | { type: 'eq'|'neq'|'gt'|'lt'; ref: DataRef; value: any };

/** ---------- Output Post-Processing ---------- */

export type ResponseTransform =
  | { type: 'regexExtract'; pattern: string; flags?: string; group?: number } // select one capture group (default 0)
  | { type: 'regexReplace'; pattern: string; flags?: string; replace: string };

/** ---------- Render Inputs & Outputs ---------- */

export type ChatCompletionMessage = {
  role: ChatCompletonMessageRole;
  content: string;
  /** If true and role==='assistant', this is a required prefix; capability must be enforced upstream. */
  prefix?: boolean;
};

export interface BudgetManager {
  /** Returns true if any tokens remain globally. */
  hasAny(): boolean;
  /** Estimate whether the given text would fit (implementation-defined estimator). */
  canFitTokenEstimate(text: string): boolean;
  /** Consume tokens for text (implementation-defined estimator). */
  consume(text: string): void;
  /** Run a sub-budget (e.g., per-slot) while still decrementing the global counters. */
  withNodeBudget(budget: Budget | undefined, thunk: () => void): void;
}

/** ---------- Source Registry ---------- */

export interface SourceRegistry<K extends TaskKind> {
  /** Resolve a DataRef for a given task context. Must be pure & synchronous. */
  resolve(ref: DataRef, ctx: TaskCtx<K>): unknown;
  /** Optional: enumerate valid source names for authoring-time validation. */
  list?(): string[];
}

/** ---------- Render signature ---------- */

export function render<K extends TaskKind>(
  template: TaskBoundTemplate<K>,
  ctx: TaskCtx<K>,
  budget: BudgetManager,
  registry: SourceRegistry<K>
): ChatCompletionMessage[];
```

**Notes**

* The renderer never accesses databases or external services; `ctx` must already contain normalized DTOs for the task.
* The registry is the **only** mechanism to resolve `DataRef` (e.g., “turns with limit 8”). No hardcoded domain refs exist in the core DSL.

---

## 4) Rendering Algorithm (normative)

**Inputs:** `template: TaskBoundTemplate<K>`, `ctx: TaskCtx<K>`, `budget: BudgetManager`, `registry: SourceRegistry<K>`.
**Output:** `ChatCompletionMessage[]`.

**Phase A – Fill (by priority):**

1. Sort `slotNames` by `slots[name].priority` ascending (0 first).
2. For each slot:

    * If `when` present and evaluates false, skip.

    * If `budget.hasAny()` is false, stop filling further slots.

    * Evaluate `slot.plan` under `budget.withNodeBudget(slot.budget, ...)`:

        * `message` node: compute content (prefer `from` via `registry.resolve(from, ctx)`; otherwise use `content`). If `budget.canFitTokenEstimate(text)` then `budget.consume(text)` and append `{role, content, prefix?}` to the slot buffer; else omit.
        * `forEach` node: resolve `array = registry.resolve(source, ctx)`; apply `order` and `limit`. For each `item`, evaluate `map` in a child scope. If `stopWhenOutOfBudget` (default true) and the next emission wouldn’t fit, **break**.
        * `if` node: evaluate `ConditionRef` by resolving `ref` via the registry; choose `then` or `else`.

    * Store the resulting messages in `filled[slotName]`.

**Phase B – Assemble (by layout order):**

1. Initialize `out: ChatCompletionMessage[] = []`.
2. For each node in `layout`:

    * `message`: resolve `from` (if present) via `registry`, otherwise use `content`. Emit subject to global budget checks as in Phase A.

    * `slot`: read `filled[name]`:

        * If empty and `omitIfEmpty !== false`, skip entirely.
        * If non-empty and `header` present, emit header block(s) (subject to budget).
        * Emit all slot messages (already budget-checked in Phase A; do **not** re-check).
        * If non-empty and `footer` present, emit footer block(s).

    * `separator`: treat as a `user` message with given text (subject to budget).

**Post-conditions & validation:**

* The returned `ChatCompletionMessage[]` is the final prompt. If any message sets `role:'assistant'` and `prefix:true`, this is a **hard requirement** signaled to the caller; enforcement happens outside the renderer.
* If the layout references a **nonexistent slot name**, this is a **template authoring error** (the renderer SHOULD throw).

**Determinism:**

* Given the same template, context, registry, and budget estimator, rendering MUST be deterministic.

---

## 5) Data Resolution Semantics

* All **DataRefs** are resolved through the **Source Registry** for the template’s **TaskKind**:

    * Example (Turn Generation):

        * `source:'turns', args:{ order:'desc', limit:8 }` → returns an array of `TurnLite`.
        * `source:'chapterSummaries', args:{ order:'desc', limit:5 }` → returns an array of summaries.
        * `source:'characters', args:{ ids?: string[] }` → returns an array of `CharacterLite`.
        * `source:'intent'` → returns the current intent object.
        * `source:'stepOutput', args:{ key: string }` → returns a prior step’s captured output (string or object).
* `item`: Within a `forEach`’s `map`, a special data scope exposes the loop `item` for leaf templating (e.g., `{{item.summary}}`).
* If a resolution returns `undefined`/`null`, the node emits nothing. The renderer MUST NOT throw for missing data.

---

## 6) Conditions

* `exists`: true if `registry.resolve(ref, ctx)` returns a value not `undefined`/`null`.
* `nonEmpty`: true if the resolved value is an array/string with length > 0.
* Comparators (`eq`/`neq`/`gt`/`lt`) compare primitives; objects are compared by JSON-stringified equality.

---

## 7) Budgeting Rules

* **Global budget** is authoritative; per-slot/per-node budgets are ceilings within that global limit.
* The renderer **does not** auto-truncate strings. If `canFitTokenEstimate(content) === false`, the emission is **skipped** (or the `forEach` loop breaks, depending on node).
* Token estimation is implementation-defined and pluggable.

---

## 8) Response Transforms (optional)

Transforms apply **after** the model’s assistant text is obtained and **before** the step captures it.

* `regexExtract`: Applies the regex to the text; if a match is found, replace the entire text with `match[group]` (default group 0). If no match, leave unchanged.
* `regexReplace`: Standard global replacement.

Transforms run **in order** and MUST NOT throw; on failure, leave text unchanged.

---

## 9) Examples

Note: examples are illustrative. Source names may not match the final implementation.

### 9.1 Turn Writer

* Fill **turns first** (priority 0), then **summaries** (priority 1), then **examples** only if there is no current-chapter history (priority 2).
* Display **summaries before turns** in the final layout.

```json
{
  "id": "tpl_turn_writer_v2",
  "task": "turn_generation",
  "name": "Turn Writer",
  "version": 1,
  "layout": [
    { "kind": "message", "role": "system", "content": "You write vivid, concise third-person prose." },
    { "kind": "message", "role": "user", "content": "Respect this player intent: {{currentIntent.description}}" },

    { "kind": "slot", "name": "summaries",
      "header": { "role": "user", "content": "Earlier events:" },
      "omitIfEmpty": true
    },

    { "kind": "slot", "name": "turns",
      "header": { "role": "user", "content": "Recent scene turns (newest first):" },
      "omitIfEmpty": true
    },

    { "kind": "slot", "name": "examples",
      "header": { "role": "user", "content": "Character writing examples:" },
      "omitIfEmpty": true
    },

    { "kind": "message", "role": "user", "content": "Write the next turn as prose. 200–350 words. No meta commentary." }
  ],
  "slots": {
    "turns": {
      "priority": 0,
      "budget": { "maxTokens": 900 },
      "plan": [
        { "kind": "forEach",
          "source": { "source": "turns", "args": { "order": "desc", "limit": 8 } },
          "map": [
            { "kind": "message", "role": "user",
              "content": "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}" }
          ],
          "budget": { "maxTokens": 900 },
          "stopWhenOutOfBudget": true
        }
      ]
    },
    "summaries": {
      "priority": 1,
      "budget": { "maxTokens": 700 },
      "plan": [
        { "kind": "forEach",
          "source": { "source": "chapterSummaries", "args": { "order": "desc", "limit": 5 } },
          "map": [
            { "kind": "message", "role": "user",
              "content": "Ch {{item.chapterNo}}: {{item.summary}}" }
          ],
          "budget": { "maxTokens": 700 },
          "stopWhenOutOfBudget": true
        }
      ]
    },
    "examples": {
      "priority": 2,
      "when": { "type": "eq",
        "ref": { "source": "turns", "args": { "order": "desc", "limit": 1 } },
        "value": [] },
      "budget": { "maxTokens": 500 },
      "plan": [
        { "kind": "forEach",
          "source": { "source": "characters", "args": { "order": "asc", "limit": 4 } },
          "map": [
            { "kind": "message", "role": "user",
              "content": "{{item.name}} — Example: {{item.description}}" }
          ],
          "budget": { "maxTokens": 500 },
          "stopWhenOutOfBudget": true
        }
      ]
    }
  },
  "responseFormat": "text"
}
```

### 9.2 Planner → Writer (step chaining via registry)

Demonstrates a two-step workflow. The renderer does not handle step chaining directly; the application must capture the first step’s output and pass it to the second via the `stepOutput` registry.

**Planner** template (outputs JSON plan; requires assistant prefix):

```json
{
  "id": "tpl_turn_planner_v1",
  "task": "turn_generation",
  "name": "Planner v1",
  "version": 1,
  "layout": [
    { "kind": "message", "role": "system",
      "content": "You are the narrative planner for this scene. Think step-by-step but output only the plan." },
    { "kind": "message", "role": "user",
      "content": "Constraint: {{currentIntent.constraint}}" },
    { "kind": "slot", "name": "chars", "omitIfEmpty": true },
    { "kind": "slot", "name": "turns", "omitIfEmpty": true },
    { "kind": "message", "role": "user", "content": "Now produce a plan (bullets). Return JSON with keys: goals, beats, risks." },
    { "kind": "message", "role": "assistant", "content": "{\"goals\":", "prefix": true }
  ],
  "slots": {
    "turns": {
      "priority": 0,
      "budget": { "maxTokens": 900 },
      "plan": [
        { "kind": "forEach",
          "source": { "source": "turns", "args": { "order": "desc", "limit": 8 } },
          "map": [
            { "kind": "message", "role": "user",
              "content": "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}" }
          ],
          "budget": { "maxTokens": 900 }
        }
      ]
    },
    "chars": {
      "priority": 1,
      "budget": { "maxTokens": 600 },
      "plan": [
        { "kind": "forEach",
          "source": { "source": "characters", "args": { "order": "asc", "limit": 6 } },
          "map": [
            { "kind": "message", "role": "user",
              "content": "{{item.name}} — {{item.description}}" }
          ],
          "budget": { "maxTokens": 600 }
        }
      ]
    }
  },
  "responseFormat": { "type": "json_schema",
    "schema": { "type": "object",
      "properties": {
        "goals": { "type": "array", "items": { "type": "string" } },
        "beats":  { "type": "array", "items": { "type": "string" } },
        "risks":  { "type": "array", "items": { "type": "string" } }
      },
      "required": ["goals","beats"] } },
  "responseTransforms": [
    { "type": "regexExtract", "pattern": "\\{[\\s\\S]*\\}$", "flags": "m", "group": 0 }
  ]
}
```

**Writer** template (consumes planner output via registry):

```json
{
  "id": "tpl_turn_writer_from_plan_v1",
  "task": "turn_generation",
  "name": "Writer from Planner v1",
  "version": 1,
  "layout": [
    { "kind": "message", "role": "system", "content": "You write vivid, concise third-person prose. Keep continuity and respect constraints." },
    { "kind": "message", "role": "user", "content": "Player intent to respect: {{currentIntent.description}}" },
    { "kind": "message", "role": "user", "content": "Planner guidance follows." },
    { "kind": "slot", "name": "plan", "omitIfEmpty": true },
    { "kind": "slot", "name": "context", "omitIfEmpty": true },
    { "kind": "message", "role": "user", "content": "Write the next turn as prose. 200–350 words. No meta commentary." }
  ],
  "slots": {
    "context": {
      "priority": 0,
      "budget": { "maxTokens": 600 },
      "plan": [
        { "kind": "forEach",
          "source": { "source": "turns", "args": { "order": "desc", "limit": 6 } },
          "map": [
            { "kind": "message", "role": "user",
              "content": "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}" }
          ],
          "budget": { "maxTokens": 600 }
        }
      ]
    },
    "plan": {
      "priority": 1,
      "budget": { "maxTokens": 600 },
      "plan": [
        { "kind": "message", "role": "user",
          "from": { "source": "stepOutput", "args": { "key": "planner.plan" } },
          "budget": { "maxTokens": 600 } }
      ]
    }
  },
  "responseFormat": "text"
}
```

---

## 10) Error Handling

* **Template authoring errors** (e.g., layout references unknown slot) SHOULD throw at render time.
* **Missing data** (e.g., a `DataRef` resolves to `undefined`) results in **no emission** for that node; the renderer MUST NOT throw.
* **Budget exhaustion**: loops stop early; single messages that do not fit are omitted.
* **Transforms** never throw; if a regex fails to match, the text remains unchanged.

---

## 11) Versioning

* Each template has a monotonically increasing `version` (integer).
* This DSL document is **v1**. Backwards-incompatible DSL changes MUST bump this version.

---
