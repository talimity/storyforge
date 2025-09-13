import type { SqliteTxLike } from "@storyforge/db";
import { sql } from "drizzle-orm";

/**
 * Resolve the deepest leaf under the given turn by following the left-most
 * child at each step (first by sibling_order). If the input is already a leaf,
 * it is returned unchanged.
 */
export async function resolveLeafFrom(tx: SqliteTxLike, fromTurnId: string): Promise<string> {
  const row = await tx.get<{ id: string }>(sql`
    WITH RECURSIVE leaf_path AS (
      SELECT id, 0 as depth
      FROM turns
      WHERE id = ${fromTurnId}

      UNION ALL

      SELECT t.id, lp.depth + 1
      FROM turns t
      INNER JOIN leaf_path lp ON t.parent_turn_id = lp.id
      WHERE NOT EXISTS (
        SELECT 1
        FROM turns t2
        WHERE t2.parent_turn_id = lp.id AND t2.sibling_order < t.sibling_order
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
