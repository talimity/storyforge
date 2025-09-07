/** ---------- Generic source specification ---------- */

export type SourceSpec = Record<string, { args: unknown; out: unknown }>;

export type SourceNames<S extends SourceSpec> = keyof S & string;

/** ---------- Template & Layout ---------- */

export type ChatCompletionMessageRole = "system" | "user" | "assistant";

export type MessageBlock<S extends SourceSpec = SourceSpec> = {
  role: ChatCompletionMessageRole;
  content?: string;
  from?: DataRefOf<S>;
  prefix?: boolean;
};

export type LayoutNode<S extends SourceSpec = SourceSpec> =
  | {
      kind: "message";
      role: ChatCompletionMessageRole;
      content?: string;
      from?: DataRefOf<S>;
      prefix?: boolean;
    }
  | {
      kind: "slot";
      name: string;
      header?: MessageBlock<S> | MessageBlock<S>[];
      footer?: MessageBlock<S> | MessageBlock<S>[];
      omitIfEmpty?: boolean;
    };

export type PromptTemplate<K extends string, S extends SourceSpec = SourceSpec> = {
  id: string;
  name: string;
  description?: string;
  task: K;
  version: 1;
  layout: LayoutNode<S>[];
  slots: Record<string, SlotSpec<S>>;
};

/** ---------- DataRef via Source Registry ---------- */

export type DataRef<K extends string, A> = A extends never
  ? { source: K } // args disallowed
  : [undefined] extends [A]
    ? { source: K; args?: A }
    : { source: K; args: A };

export type DataRefOf<S extends SourceSpec> = {
  [K in SourceNames<S>]: DataRef<K, S[K]["args"]>;
}[SourceNames<S>];

export type ArrayDataRefOf<S extends SourceSpec> = {
  [K in SourceNames<S>]: S[K]["out"] extends ReadonlyArray<unknown>
    ? DataRef<K, S[K]["args"]>
    : never;
}[SourceNames<S>];

/** ---------- Slots & Plans ---------- */

export type Budget = {
  /** Hard ceiling for this node/slot; renderer will stop before exceeding it. */
  maxTokens?: number;
};

export type SlotSpec<S extends SourceSpec = SourceSpec> = {
  /** Lower number = higher priority (0 fills before 1). */
  priority: number;
  /** Optional condition to decide whether the slot should render at all. */
  when?: ConditionRef<S>;
  /** Per-slot ceiling (in addition to the global budget). */
  budget?: Budget;
  /** Emits the slot's candidate messages, evaluated under the slot+global budget. */
  plan: PlanNode<S>[];
  /** Arbitrary metadata for authoring-time use (e.g., UI hints). */
  meta: Record<string, unknown>;
};

export type PlanNode<S extends SourceSpec = SourceSpec> =
  | {
      kind: "message";
      role: ChatCompletionMessageRole;
      content?: string;
      from?: DataRefOf<S>;
      prefix?: boolean;
      budget?: Budget;
    }
  | {
      kind: "forEach";
      source: ArrayDataRefOf<S>;
      order?: "asc" | "desc";
      limit?: number;
      map: PlanNode<S>[]; // evaluated with {item} in scope
      interleave?: { kind: "separator"; text?: string };
      budget?: Budget;
      stopWhenOutOfBudget?: boolean; // default: true
    }
  | {
      kind: "if";
      when: ConditionRef<S>;
      then: PlanNode<S>[];
      else?: PlanNode<S>[];
    };

/** ---------- Conditions ---------- */

export type ConditionRef<S extends SourceSpec = SourceSpec> =
  | { type: "exists"; ref: DataRefOf<S> }
  | { type: "nonEmpty"; ref: DataRefOf<S> }
  | {
      type: "eq" | "neq" | "gt" | "lt";
      ref: DataRefOf<S>;
      value: unknown;
    };

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

export interface SourceRegistry<Ctx, S extends SourceSpec> {
  /** Resolve a DataRef for a given task context. Must be pure & synchronous. */
  resolve<K extends keyof S & string>(
    ref: DataRef<K, S[K]["args"]>,
    ctx: Ctx
  ): S[K]["out"] | undefined;
  /** Optional: enumerate valid source names for authoring-time validation. */
  list?(): Array<keyof S & string>;
}

/**
 * Source handler function type - receives a DataRef and task context,
 * returns any value that the source provides.
 */
export type SourceHandler<Ctx, S extends SourceSpec, K extends keyof S & string> = (
  ref: DataRef<K, S[K]["args"]>,
  ctx: Ctx
) => S[K]["out"];

export type SourceHandlerMap<Ctx, S extends SourceSpec> = {
  [K in keyof S & string]: SourceHandler<Ctx, S, K & string>;
};

/** ---------- Compiled Template Types ---------- */

export type CompiledLeafFunction = (scope: unknown) => string;

export type CompileOptions = {
  kind?: string;
  /**
   * List of allowed source names for validation, to more strictly enforce that
   * a template only uses the correct sources for its task type.
   */
  allowedSources?: readonly string[];
};

/** A prompt template where all leaf strings have been compiled to functions */
export type CompiledTemplate<
  K extends string = string,
  S extends SourceSpec = SourceSpec,
> = Readonly<{
  id: string;
  task: K;
  name: string;
  version: number;
  layout: readonly CompiledLayoutNode<S>[];
  slots: Readonly<Record<string, CompiledSlotSpec<S>>>;
}>;

export type CompiledLayoutNode<S extends SourceSpec = SourceSpec> = Readonly<
  | {
      kind: "message";
      name?: string;
      role: ChatCompletionMessageRole;
      content?: CompiledLeafFunction;
      from?: DataRefOf<S>;
      prefix?: boolean;
    }
  | {
      kind: "slot";
      name: string;
      header?: readonly CompiledMessageBlock<S>[];
      footer?: readonly CompiledMessageBlock<S>[];
      omitIfEmpty?: boolean;
    }
>;

export type CompiledSlotSpec<S extends SourceSpec = SourceSpec> = Readonly<{
  priority: number;
  when?: ConditionRef<S>;
  budget?: Budget;
  plan: readonly CompiledPlanNode<S>[];
}>;

export type CompiledPlanNode<S extends SourceSpec = SourceSpec> = Readonly<
  | {
      kind: "message";
      role: ChatCompletionMessageRole;
      content?: CompiledLeafFunction;
      from?: DataRefOf<S>;
      prefix?: boolean;
      budget?: Budget;
    }
  | {
      kind: "forEach";
      source: ArrayDataRefOf<S>;
      order?: "asc" | "desc";
      limit?: number;
      map: readonly CompiledPlanNode<S>[];
      interleave?: { kind: "separator"; text?: CompiledLeafFunction };
      budget?: Budget;
      stopWhenOutOfBudget?: boolean;
    }
  | {
      kind: "if";
      when: ConditionRef<S>;
      then: readonly CompiledPlanNode<S>[];
      else?: readonly CompiledPlanNode<S>[];
    }
>;

export type CompiledMessageBlock<S extends SourceSpec = SourceSpec> = Readonly<{
  role: ChatCompletionMessageRole;
  content?: CompiledLeafFunction;
  from?: DataRefOf<S>;
  prefix?: boolean;
}>;

/** ---------- Unbound types for API/DB boundaries ---------- */
// biome-ignore-start lint/suspicious/noExplicitAny: erasing SourceSpec
export type UnboundTemplate = PromptTemplate<string, any>;
export type UnboundSources = any;
export type UnboundLayoutNode = LayoutNode<any>;
export type UnboundSlotSpec = SlotSpec<any>;
export type UnboundPlanNode = PlanNode<any>;
export type UnboundConditionRef = ConditionRef<any>;
export type UnboundDataRef = DataRefOf<any>;
// biome-ignore-end lint/suspicious/noExplicitAny: erasing SourceSpec
