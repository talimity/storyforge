import type { SqliteTxLike } from "@storyforge/db";
import { type SQL, sql } from "drizzle-orm";

export type LeafResolutionStrategy = "leftmost" | "mostRecentCreated" | "mostRecentUpdated";

export interface ResolveLeafOptions {
  strategy?: LeafResolutionStrategy;
}

const DEFAULT_STRATEGY: LeafResolutionStrategy = "leftmost";

const strategyComparators: Record<LeafResolutionStrategy, SQL> = {
  leftmost: sql`sibling.sibling_order < child.sibling_order`,
  mostRecentCreated: sql`
    sibling.created_at > child.created_at
    OR (sibling.created_at = child.created_at AND sibling.sibling_order > child.sibling_order)
  `,
  mostRecentUpdated: sql`
    sibling.updated_at > child.updated_at
    OR (sibling.updated_at = child.updated_at AND sibling.sibling_order > child.sibling_order)
  `,
};

/**
 * Resolve the deepest leaf under the given turn using the provided strategy.
 * If the input is already a leaf, it is returned unchanged.
 */
export async function resolveLeafFrom(
  tx: SqliteTxLike,
  fromTurnId: string,
  options: ResolveLeafOptions = {}
): Promise<string> {
  const { strategy = DEFAULT_STRATEGY } = options;
  const comparator = strategyComparators[strategy];

  const row = await tx.get<{ id: string }>(sql`
    WITH RECURSIVE leaf_path AS (
      SELECT id, 0 as depth
      FROM turns
      WHERE id = ${fromTurnId}

      UNION ALL

      SELECT child.id, lp.depth + 1
      FROM turns child
      INNER JOIN leaf_path lp ON child.parent_turn_id = lp.id
      WHERE NOT EXISTS (
        SELECT 1
        FROM turns sibling
        WHERE sibling.parent_turn_id = lp.id AND (${comparator})
      )
    )
    SELECT lp.id
    FROM leaf_path lp
    WHERE NOT EXISTS (SELECT 1 FROM turns t WHERE t.parent_turn_id = lp.id)
    ORDER BY depth DESC
    LIMIT 1;
  `);

  return row?.id ?? fromTurnId;
}

export const leafResolutionStrategies = {
  leftmost: "leftmost",
  mostRecentCreated: "mostRecentCreated",
  mostRecentUpdated: "mostRecentUpdated",
} as const satisfies Record<string, LeafResolutionStrategy>;
