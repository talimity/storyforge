import { type SqliteTransaction, schema } from "@storyforge/db";
import { EMPTY_RANK, ranksBetween } from "@storyforge/utils";
import { eq, inArray, sql } from "drizzle-orm";

/** Method for handling children of deleted turn */
export type TurnGraphDeleteMode = "cascade" | "promote";

/** Snapshot of the relevant part of the turn graph for planning a deletion */
export type DeletionSnapshot = {
  scenario: ScenarioLite;
  target: TurnLite;
  children: TurnLite[]; // ordered by sibling_order
  siblings: Array<{ id: string; order: string }>; // same parent as target, ordered
  descendants?: string[]; // only when cascade = true; includes target
};

/** Describes how the scenario's anchor turn should be updated after deletion */
type TurnGraphAnchorPlan =
  | { kind: "unchanged" } // anchor unaffected
  | { kind: "clear" } // no sensible anchor remains
  | { kind: "set"; turnId: string }; // new anchor id

/** Describes a full plan for deleting a turn from the graph */
type TurnGraphDeletionPlan = {
  mode: TurnGraphDeleteMode;
  targetTurnId: string;
  mutations: Array<
    | { op: "deleteTurns"; ids: string[] }
    | {
        op: "reparent";
        id: string;
        newParentId: string | null;
        newOrder: string;
      }
  >;
  anchorPlan: TurnGraphAnchorPlan;
};

type TurnLite = {
  id: string;
  scenarioId: string;
  parentTurnId: string | null;
  siblingOrder: string;
  chapterId: string;
};

type ScenarioLite = { id: string; anchorTurnId: string | null };

export function planDeletion(
  snap: DeletionSnapshot,
  mode: "cascade" | "promote"
): TurnGraphDeletionPlan {
  return mode === "cascade" ? planCascadeDelete(snap) : planPromoteDelete(snap);
}

export function planCascadeDelete(s: DeletionSnapshot): TurnGraphDeletionPlan {
  const toDelete = s.descendants ?? [s.target.id]; // include target and all descendants
  const anchorPlan: TurnGraphAnchorPlan =
    s.scenario.anchorTurnId && toDelete.includes(s.scenario.anchorTurnId)
      ? s.target.parentTurnId // anchor is being deleted
        ? { kind: "set", turnId: s.target.parentTurnId } // parent becomes new anchor
        : { kind: "clear" } // (no parent, so clear anchor)
      : { kind: "unchanged" };

  return {
    mode: "cascade",
    targetTurnId: s.target.id,
    mutations: [{ op: "deleteTurns", ids: toDelete }],
    anchorPlan,
  };
}

export function planPromoteDelete(s: DeletionSnapshot): TurnGraphDeletionPlan {
  const hasChildren = s.children.length > 0;

  // 1) Find an insert position for the promoted children between existing siblings
  const idx = s.siblings.findIndex((x) => x.id === s.target.id);
  const before = idx > 0 ? s.siblings[idx - 1].order : EMPTY_RANK;
  const after = idx < s.siblings.length - 1 ? s.siblings[idx + 1].order : EMPTY_RANK;

  const mutations: TurnGraphDeletionPlan["mutations"] = [
    // delete target first so we don't get a sibling order constraint violation
    { op: "deleteTurns", ids: [s.target.id] },
  ];

  if (hasChildren) {
    // 2) Compute new sibling orders for children
    const newOrders = ranksBetween(before, after, s.children.length);

    // 3) Reparent each child to target.parent
    for (let i = 0; i < s.children.length; i++) {
      const c = s.children[i];
      mutations.push({
        op: "reparent",
        id: c.id,
        newParentId: s.target.parentTurnId,
        newOrder: newOrders[i],
      });
    }
  }

  // 4) Anchor plan
  const anchorPlan: TurnGraphAnchorPlan = (() => {
    const A = s.scenario.anchorTurnId;
    if (!A) return { kind: "unchanged" };
    if (A !== s.target.id) return { kind: "unchanged" };

    if (hasChildren) {
      // Pick the leftmost promoted child as the new anchor
      const leftmost = s.children[0];
      return { kind: "set", turnId: leftmost.id };
    } else {
      // No children → promote parent as anchor, or clear (graph empty)
      return s.target.parentTurnId
        ? { kind: "set", turnId: s.target.parentTurnId }
        : { kind: "clear" };
    }
  })();

  return { mode: "promote", targetTurnId: s.target.id, mutations, anchorPlan };
}

/**
 * Given a proposed anchor turn ID, traverse down the graph to find the actual
 * leaf node along that path. This is necessary because the requested anchor may
 * not be a leaf itself, and we need to ensure the anchor is always a leaf turn.
 */
async function findLeafFromProposedAnchor(
  tx: SqliteTransaction,
  anchorId: string
): Promise<string> {
  // Use a recursive CTE to find the leaf node by following the first child path
  const result = await tx.get<{ id: string }>(
    sql`
      WITH RECURSIVE leaf_path AS (
        -- Base case: start with the proposed anchor
        SELECT id, 0 as depth
        FROM turns
        WHERE id = ${anchorId}
        
        UNION ALL
        
        -- Recursive case: find the first child (by sibling_order) of the current turn
        SELECT t.id, lp.depth + 1
        FROM turns t
        INNER JOIN leaf_path lp ON t.parent_turn_id = lp.id
        WHERE NOT EXISTS (
          SELECT 1 
          FROM turns t2 
          WHERE t2.parent_turn_id = lp.id 
          AND t2.sibling_order < t.sibling_order
        )
      )
      -- Return the deepest row in the path (the leaf - a turn with no children)
      SELECT lp.id
      FROM leaf_path lp
      WHERE NOT EXISTS (
        SELECT 1 
        FROM turns t 
        WHERE t.parent_turn_id = lp.id
      )
      ORDER BY depth DESC
      LIMIT 1
    `
  );

  // If no result (shouldn't happen), return the original anchor
  return result?.id ?? anchorId;
}

export async function executeDeletionPlan(
  tx: SqliteTransaction,
  plan: TurnGraphDeletionPlan,
  scenarioId: string
) {
  for (const m of plan.mutations) {
    if (m.op === "deleteTurns") {
      await tx.delete(schema.turns).where(inArray(schema.turns.id, m.ids));
    } else if (m.op === "reparent") {
      await tx
        .update(schema.turns)
        .set({ parentTurnId: m.newParentId, siblingOrder: m.newOrder })
        .where(eq(schema.turns.id, m.id));
    }
  }

  if (plan.anchorPlan.kind === "set") {
    // Find the actual leaf turn by traversing down from the proposed anchor
    const leafTurnId = await findLeafFromProposedAnchor(tx, plan.anchorPlan.turnId);
    await tx
      .update(schema.scenarios)
      .set({ anchorTurnId: leafTurnId })
      .where(eq(schema.scenarios.id, scenarioId));
  } else if (plan.anchorPlan.kind === "clear") {
    await tx
      .update(schema.scenarios)
      .set({ anchorTurnId: null })
      .where(eq(schema.scenarios.id, scenarioId));
  }
}
