import type {
  DataRefOf,
  LayoutNode,
  MessageBlock,
  PlanNode,
  PromptTemplate,
  SourceSpec,
} from "./types.js";

/** A breadcrumb path to be displayed in errors, e.g. "layout[0]" or "slots.content.if.then[1]" */
export type NodePath = string;

type PathSeg = string;
const join = (segs: PathSeg[]) => segs.join(".");

function normalizeBlocks<S extends SourceSpec>(
  b?: MessageBlock<S> | MessageBlock<S>[]
): MessageBlock<S>[] {
  if (!b) return [];
  return Array.isArray(b) ? b : [b];
}

function toMessageBlock<S extends SourceSpec>(
  node: (LayoutNode<S> | PlanNode<S>) & { kind: "message" }
): MessageBlock<S> {
  return {
    role: node.role,
    content: node.content,
    from: node.from,
    skipIfEmptyInterpolation: node.skipIfEmptyInterpolation,
  };
}

/** Yield every message-like block in the template, regardless of where it appears. */
export function* iterMessageBlocks<K extends string, S extends SourceSpec>(
  tpl: PromptTemplate<K, S>
): Generator<{ block: MessageBlock<S>; path: NodePath }> {
  const root: PathSeg[] = [];

  // Layout nodes
  for (let i = 0; i < tpl.layout.length; i++) {
    const node = tpl.layout[i];
    const here = [...root, `layout[${i}]`];

    if (node.kind === "message") {
      // Yield message blocks directly
      yield { block: toMessageBlock(node), path: join(here) };
    } else if (node.kind === "slot") {
      // Yield header message blocks
      const headers = normalizeBlocks(node.header);
      for (let idx = 0; idx < headers.length; idx++) {
        yield { block: headers[idx], path: join([...here, `header[${idx}]`]) };
      }

      // Yield footer message blocks
      const footers = normalizeBlocks(node.footer);
      for (let idx = 0; idx < footers.length; idx++) {
        yield { block: footers[idx], path: join([...here, `footer[${idx}]`]) };
      }
    }
  }

  // Yield message blocks from slot filling plans, recursively
  for (const [slotName, slot] of Object.entries(tpl.slots)) {
    const base = [...root, `slots.${slotName}`];
    for (const item of walkPlanNodes(slot.plan, base)) {
      yield item;
    }
  }
}

function* walkPlanNodes<S extends SourceSpec>(
  nodes: PlanNode<S>[],
  base: PathSeg[]
): Generator<{ block: MessageBlock<S>; path: NodePath }> {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const here = [...base, `plan[${i}]`];

    if (node.kind === "message") {
      yield { block: toMessageBlock(node), path: join(here) };
    } else if (node.kind === "forEach") {
      for (let j = 0; j < node.map.length; j++) {
        const child = node.map[j];
        const childBase = [...here, `forEach.map[${j}]`];

        if (child.kind === "message") {
          yield { block: toMessageBlock(child), path: join(childBase) };
        } else {
          for (const nested of walkPlanNodes([child], childBase)) {
            yield nested;
          }
        }
      }
    } else if (node.kind === "if") {
      for (let j = 0; j < node.then.length; j++) {
        const t = node.then[j];
        for (const nested of walkPlanNodes([t], [...here, `if.then[${j}]`])) {
          yield nested;
        }
      }
      if (node.else) {
        for (let j = 0; j < node.else.length; j++) {
          const e = node.else[j];
          for (const nested of walkPlanNodes([e], [...here, `if.else[${j}]`])) {
            yield nested;
          }
        }
      }
    }
  }
}

/** Yield every DataRef in the template with a precise path for diagnostics. */
export function* iterDataRefs<K extends string, S extends SourceSpec>(
  tpl: PromptTemplate<K, S>
): Generator<{ ref: DataRefOf<S>; path: NodePath }> {
  const root: PathSeg[] = [];

  // Layout nodes
  for (let i = 0; i < tpl.layout.length; i++) {
    const node = tpl.layout[i];
    const here = [...root, `layout[${i}]`];

    if (node.kind === "message" && node.from) {
      // Yield references from message nodes
      yield { ref: node.from, path: join([...here, "from"]) };
    } else if (node.kind === "slot") {
      // Yield references from header blocks
      const headers = normalizeBlocks(node.header);
      for (let idx = 0; idx < headers.length; idx++) {
        const b = headers[idx];
        if (b.from) yield { ref: b.from, path: join([...here, `header[${idx}]`]) };
      }

      // Yield references from footer blocks
      const footers = normalizeBlocks(node.footer);
      for (let idx = 0; idx < footers.length; idx++) {
        const b = footers[idx];
        if (b.from) yield { ref: b.from, path: join([...here, `footer[${idx}]`]) };
      }
    }
  }

  // Slots nodes
  for (const [slotName, slot] of Object.entries(tpl.slots)) {
    const base = [...root, `slots.${slotName}`];

    // Yield references from the slot's condition
    if (slot.when) {
      yield { ref: slot.when.ref, path: join([...base, "when.ref"]) };
    }

    // Yield references from the slot's filling plan
    for (const item of walkPlanDataRefs(slot.plan, base)) {
      yield item;
    }
  }
}

/**
 * Recursively walks through an array of PlanNodes and yields all DataRefs found within them.
 *
 * This function traverses the tree structure of plan nodes, including:
 * - References in `message` nodes (`from` property)
 * - References in `forEach` nodes (`source` property and nested nodes)
 * - References in `if` nodes (`when.ref` property and nested `then`/`else` branches)
 *
 * @param nodes - The array of PlanNodes to process
 * @param base - The base path segments used to construct the complete path
 * @yields Objects containing the DataRef and its corresponding NodePath for diagnostic purposes
 */
function* walkPlanDataRefs<S extends SourceSpec>(
  nodes: PlanNode<S>[],
  base: PathSeg[]
): Generator<{ ref: DataRefOf<S>; path: NodePath }> {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const here = [...base, `plan[${i}]`];

    if (node.kind === "message" && node.from) {
      yield { ref: node.from, path: join([...here, "from"]) };
    } else if (node.kind === "forEach") {
      yield { ref: node.source, path: join([...here, "forEach.source"]) };

      // Walk through `map` nodes
      for (let j = 0; j < node.map.length; j++) {
        const child = node.map[j];
        for (const nested of walkPlanDataRefs([child], [...here, `forEach.map[${j}]`])) {
          yield nested;
        }
      }
    } else if (node.kind === "if") {
      yield { ref: node.when.ref, path: join([...here, "if.when.ref"]) };

      // Walk through `then` branches
      for (let j = 0; j < node.then.length; j++) {
        const t = node.then[j];
        for (const nested of walkPlanDataRefs([t], [...here, `if.then[${j}]`])) {
          yield nested;
        }
      }

      // Walk through `else` branches if they exist
      if (node.else) {
        for (let j = 0; j < node.else.length; j++) {
          const e = node.else[j];
          for (const nested of walkPlanDataRefs([e], [...here, `if.else[${j}]`])) {
            yield nested;
          }
        }
      }
    }
  }
}
