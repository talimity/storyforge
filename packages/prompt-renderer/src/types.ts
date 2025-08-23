/** ---------- Task binding ---------- */

export type TaskKind =
  | "turn_generation"
  | "chapter_summarization"
  | "writing_assistant";

export type TurnCtxDTO = {
  turnNo: number;
  authorName: string;
  authorType: "character" | "narrator";
  content: string;
};

export type ChapterSummCtxDTO = {
  chapterNo: number;
  summary: string;
};

export type CharacterCtxDTO = {
  id: string;
  name: string;
  description: string;
};

// TODO: Once implemented in main app, CharacterExamples DTO for few-shot examples
// TODO: Maybe replace `turns` with `timeline: TimelineCtxDTO[]` to include past intents

/** Task-specific render contexts */
export type TurnGenCtx = {
  turns: TurnCtxDTO[];
  chapterSummaries: ChapterSummCtxDTO[];
  characters: CharacterCtxDTO[];
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
  turns: TurnCtxDTO[];
  chapterSummaries: ChapterSummCtxDTO[];
  globals?: Record<string, unknown>;
};

export type TaskCtx<K extends TaskKind> = K extends "turn_generation"
  ? TurnGenCtx
  : K extends "chapter_summarization"
    ? ChapterSummCtx
    : K extends "writing_assistant"
      ? WritingAssistantCtx
      : never;

export type TaskBoundTemplate<K extends TaskKind> = PromptTemplate & {
  task: K;
};

export type TurnGenPromptTemplate = TaskBoundTemplate<"turn_generation">;
export type ChapterSummPromptTemplate =
  TaskBoundTemplate<"chapter_summarization">;
export type WritingAssistantPromptTemplate =
  TaskBoundTemplate<"writing_assistant">;

/** ---------- Template & Layout ---------- */

export type ChatCompletionMessageRole = "system" | "user" | "assistant";

export type MessageBlock = {
  role: ChatCompletionMessageRole;
  content?: string;
  from?: DataRef;
  prefix?: boolean;
};

export type LayoutNode =
  | {
      kind: "message";
      role: ChatCompletionMessageRole;
      content?: string;
      from?: DataRef;
      prefix?: boolean;
    }
  | {
      kind: "slot";
      name: string;
      header?: MessageBlock | MessageBlock[];
      footer?: MessageBlock | MessageBlock[];
      omitIfEmpty?: boolean;
    }
  | { kind: "separator"; text?: string };

export type PromptTemplate = {
  id: string;
  task: TaskKind;
  name: string;
  version: number;
  layout: LayoutNode[];
  slots: Record<string, SlotSpec>;
  responseFormat?: "text" | { type: "json_schema"; schema: object } | "json";
  responseTransforms?: ResponseTransform[];
};

/** ---------- DataRef via Source Registry ---------- */

export type DataRef = {
  source: string;
  args?: unknown;
};

/** ---------- Slots & Plans ---------- */

export type Budget = {
  /** Hard ceiling for this node/slot; renderer will stop before exceeding it. */
  maxTokens?: number;
  /** Soft target; renderer may stop around this value. (Advisory only.) */
  softTokens?: number;
};

export type SlotSpec = {
  /** Lower number = higher priority (0 fills before 1). */
  priority: number;
  /** Optional condition to decide whether the slot should render at all. */
  when?: ConditionRef;
  /** Per-slot ceiling (in addition to the global budget). */
  budget?: Budget;
  /** Emits the slot's candidate messages, evaluated under the slot+global budget. */
  plan: PlanNode[];
};

export type PlanNode =
  | {
      kind: "message";
      role: ChatCompletionMessageRole;
      content?: string;
      from?: DataRef;
      prefix?: boolean;
      budget?: Budget;
    }
  | {
      kind: "forEach";
      source: DataRef; // must resolve to an array
      order?: "asc" | "desc";
      limit?: number;
      map: PlanNode[]; // evaluated with {item} in scope
      interleave?: { kind: "separator"; text?: string };
      budget?: Budget;
      stopWhenOutOfBudget?: boolean;
    } // default: true
  | { kind: "if"; when: ConditionRef; then: PlanNode[]; else?: PlanNode[] };

/** ---------- Conditions ---------- */

export type ConditionRef =
  | { type: "exists"; ref: DataRef }
  | { type: "nonEmpty"; ref: DataRef }
  // biome-ignore lint/suspicious/noExplicitAny: dunno how one would type this
  | { type: "eq" | "neq" | "gt" | "lt"; ref: DataRef; value: any };

/** ---------- Output Post-Processing ---------- */

export type ResponseTransform =
  | { type: "regexExtract"; pattern: string; flags?: string; group?: number } // select one capture group (default 0)
  | { type: "regexReplace"; pattern: string; flags?: string; replace: string };

/** ---------- Render Inputs & Outputs ---------- */

export type ChatCompletionMessage = {
  role: ChatCompletionMessageRole;
  content: string;
  /** If last message is an assistant and prefix is true, the model continues from this content. Requires prefill capability. */
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

export declare function render<K extends TaskKind>(
  template: TaskBoundTemplate<K>,
  ctx: TaskCtx<K>,
  budget: BudgetManager,
  registry: SourceRegistry<K>
): ChatCompletionMessage[];

/** ---------- Compiled Template Types ---------- */

export type CompiledLeafFunction = (scope: unknown) => string;

export type CompileOptions = {
  /** List of allowed source names for validation */
  allowedSources?: string[];
  /** Task-specific source validation */
  taskKindSources?: Record<TaskKind, string[]>;
};

/** A prompt template where all leaf strings have been compiled to functions */
export type CompiledTemplate<K extends TaskKind = TaskKind> = Readonly<{
  id: string;
  task: K;
  name: string;
  version: number;
  layout: readonly CompiledLayoutNode[];
  slots: Readonly<Record<string, CompiledSlotSpec>>;
  responseFormat?: "text" | { type: "json_schema"; schema: object } | "json";
  responseTransforms?: readonly ResponseTransform[];
}>;

export type CompiledLayoutNode = Readonly<
  | {
      kind: "message";
      role: ChatCompletionMessageRole;
      content?: CompiledLeafFunction;
      from?: DataRef;
      prefix?: boolean;
    }
  | {
      kind: "slot";
      name: string;
      header?: readonly CompiledMessageBlock[];
      footer?: readonly CompiledMessageBlock[];
      omitIfEmpty?: boolean;
    }
  | {
      kind: "separator";
      text?: CompiledLeafFunction;
    }
>;

export type CompiledSlotSpec = Readonly<{
  priority: number;
  when?: ConditionRef;
  budget?: Budget;
  plan: readonly CompiledPlanNode[];
}>;

export type CompiledPlanNode = Readonly<
  | {
      kind: "message";
      role: ChatCompletionMessageRole;
      content?: CompiledLeafFunction;
      from?: DataRef;
      prefix?: boolean;
      budget?: Budget;
    }
  | {
      kind: "forEach";
      source: DataRef;
      order?: "asc" | "desc";
      limit?: number;
      map: readonly CompiledPlanNode[];
      interleave?: { kind: "separator"; text?: CompiledLeafFunction };
      budget?: Budget;
      stopWhenOutOfBudget?: boolean;
    }
  | {
      kind: "if";
      when: ConditionRef;
      then: readonly CompiledPlanNode[];
      else?: readonly CompiledPlanNode[];
    }
>;

export type CompiledMessageBlock = Readonly<{
  role: ChatCompletionMessageRole;
  content?: CompiledLeafFunction;
  from?: DataRef;
  prefix?: boolean;
}>;
