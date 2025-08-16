import type { StoryforgeSqliteDatabase } from "@storyforge/db";
import { schema } from "@storyforge/db";
import { sql } from "drizzle-orm";

export type TurnTimelineRow = {
  id: string;
  parent_turn_id: string | null;
  sibling_order: number;
  depth: number; // 0 = leaf, grows toward root
  prev_sibling_id: string | null;
  next_sibling_id: string | null;
};

export type TurnTimelineWindowParams = {
  leafTurnId: string;
  windowSize: number; // number of nodes from the leaf upward to include
};

/**
 * Returns the path from the leaf turn up to the root, windowed to the last N nodes,
 * with prev/next siblings for branch navigation.
 *
 * Notes:
 *  - Uses a recursive CTE to walk leaf -> root (depth 0 = leaf).
 *  - Computes sibling prev/next per parent using window functions.
 *  - We first compute the full path (so parents exist for top-of-window nodes),
 *    then slice the last N and reorder for UI (root -> leaf).
 */
export async function getTurnTimelineWindow(
  db: StoryforgeSqliteDatabase,
  params: TurnTimelineWindowParams
): Promise<TurnTimelineRow[]> {
  const { leafTurnId, windowSize } = params;

  const rows = db.all<TurnTimelineRow>(sql`
    WITH RECURSIVE timeline AS (
      SELECT id, parent_turn_id, sibling_order, 0 AS depth
      FROM ${schema.turns}
      WHERE id = ${leafTurnId}
      UNION ALL
      SELECT t.id, t.parent_turn_id, t.sibling_order, depth + 1
      FROM ${schema.turns} t
      JOIN timeline p ON p.parent_turn_id = t.id
    ),
    siblings AS (
      SELECT id,
             LAG(id)  OVER (PARTITION BY parent_turn_id ORDER BY sibling_order) AS prev_sibling_id,
             LEAD(id) OVER (PARTITION BY parent_turn_id ORDER BY sibling_order) AS next_sibling_id
      FROM ${schema.turns}
      WHERE parent_turn_id IN (SELECT id FROM timeline)
    ),
    enriched AS (
      SELECT tl.id,
             tl.parent_turn_id,
             tl.sibling_order,
             tl.depth,
             s.prev_sibling_id,
             s.next_sibling_id
      FROM timeline tl
      LEFT JOIN siblings s USING(id)
    )
    SELECT * FROM (
      SELECT * FROM enriched
      ORDER BY depth ASC
      LIMIT ${windowSize}
    )
    ORDER BY depth DESC; -- root -> leaf for UI
  `);

  return rows;
}

export async function getTurnById(
  db: StoryforgeSqliteDatabase,
  turnId: string
) {
  const [row] = await db
    .select()
    .from(schema.turns)
    .where(sql`${schema.turns.id} = ${turnId}`)
    .limit(1);
  return row;
}

export async function getMaxSiblingOrder(
  db: StoryforgeSqliteDatabase,
  parentTurnId: string | null
): Promise<number> {
  const [row] = db.all<{ max_order: number | null }>(sql`
    SELECT MAX(sibling_order) AS max_order
    FROM ${schema.turns}
    WHERE parent_turn_id ${parentTurnId ? sql`= ${parentTurnId}` : sql`IS NULL`}
  `);
  return row?.max_order ?? -1;
}
