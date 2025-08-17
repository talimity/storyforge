import type { SqliteDatabase } from "@storyforge/db";
import { sql } from "drizzle-orm";

export type TimelineRow = {
  id: string;
  scenario_id: string;
  chapter_id: string;
  parent_turn_id: string | null; // null for root turns
  author_participant_id: string;

  left_turn_id: string | null; // Previous sibling turn ID
  right_turn_id: string | null; // Next sibling turn ID
  swipe_count: number; // Number of siblings (swipes) for this turn
  swipe_no: number; // 1-based index of this turn among its siblings

  turn_no: number; // Global turn number (root=1, leaf=total_depth)

  content: string; // Layer content
  layer_created_at: number;
  layer_updated_at: number;

  created_at: number;
  updated_at: number;

  timeline_depth: number; // Depth from root to anchor, 1-based
};

export type TurnTimelineWindowParams = {
  leafTurnId: string | null; // starting point for the timeline window, null for anchor
  windowSize: number; // number of turns to include in the window
  scenarioId: string;
};

export async function getTimelineWindow(
  db: SqliteDatabase,
  args: TurnTimelineWindowParams
): Promise<TimelineRow[]> {
  const { leafTurnId, windowSize, scenarioId } = args;

  const params = {
    leafTurnId: leafTurnId ?? null,
    windowSize,
    scenarioId,
    layer: "presentation", // Default layer
  };

  return db.all<TimelineRow>(
    sql`WITH RECURSIVE
    -- 0) Find the scenario anchor turn
    scenario_anchor AS (SELECT anchor_turn_id AS id
                        FROM scenarios
                        WHERE id = ${params.scenarioId}),
    -- 1) Anchor chain: current anchor -> ... -> root
    anchor AS (SELECT t.id, t.parent_turn_id, 0 AS depth_from_anchor
               FROM turns t
               WHERE t.id = (SELECT id FROM scenario_anchor)
                 AND t.scenario_id = ${params.scenarioId}
               UNION ALL
               SELECT p.id, p.parent_turn_id, a.depth_from_anchor + 1
               FROM turns p
                        JOIN anchor a ON a.parent_turn_id = p.id
               WHERE p.scenario_id = ${params.scenarioId}),
    anchor_meta AS (SELECT MAX(depth_from_anchor) AS anchor_total_depth
                    FROM anchor),
    -- 2) Page chain from leaf (cursor) toward root
    page AS (SELECT t.id, t.parent_turn_id, 0 AS depth
             FROM turns t
             WHERE t.id = COALESCE(${leafTurnId}, (SELECT id FROM scenario_anchor))
               AND t.scenario_id = ${params.scenarioId}
             UNION ALL
             SELECT p.id, p.parent_turn_id, pg.depth + 1
             FROM turns p
                      JOIN page pg ON pg.parent_turn_id = p.id
             WHERE p.scenario_id = ${params.scenarioId}),
    -- 3) limit the page to windowSize (still leaf->root order)
    paged AS (SELECT *
              FROM page
              ORDER BY depth -- leaf->root for paging
              LIMIT ${windowSize}),
    -- 4) Sibling info for all parents we will render
    siblings AS (SELECT s.id,
                        LAG(s.id)
                            OVER (PARTITION BY s.parent_turn_id ORDER BY s.sibling_order)          AS prev_sibling_id,
                        LEAD(s.id)
                             OVER (PARTITION BY s.parent_turn_id ORDER BY s.sibling_order)         AS next_sibling_id,
                        COUNT(*) OVER (PARTITION BY s.parent_turn_id)                              AS sibling_count,
                        ROW_NUMBER() OVER (PARTITION BY s.parent_turn_id ORDER BY s.sibling_order) AS sibling_index_1
                 FROM turns s
                 WHERE s.scenario_id = ${params.scenarioId}
                   AND s.parent_turn_id IN (SELECT parent_turn_id
                                            FROM paged
                                            WHERE parent_turn_id IS NOT NULL)),

    -- 5) Enrich the paged rows with numbering and siblings
    enriched AS (SELECT pg.id,
                        pg.parent_turn_id,
                        pg.depth, -- page-local depth (leaf=0..)
                        a.depth_from_anchor,
                        (am.anchor_total_depth - a.depth_from_anchor + 1) AS turn_no,
                        sb.prev_sibling_id,
                        sb.next_sibling_id,
                        COALESCE(sb.sibling_count, 1)                     AS swipe_count,
                        COALESCE(sb.sibling_index_1, 1)                   AS swipe_no
                 FROM paged pg
                          JOIN anchor a ON a.id = pg.id -- rows not on the active branch drop out
                          CROSS JOIN anchor_meta am
                          LEFT JOIN siblings sb ON sb.id = pg.id)
SELECT e.id,
       t.scenario_id,
       t.chapter_id,
       e.parent_turn_id,
       t.author_participant_id,

       e.prev_sibling_id                                              AS left_turn_id,
       e.next_sibling_id                                              AS right_turn_id,
       e.swipe_count,
       e.swipe_no, -- 1-based

       e.turn_no, -- 1-based

       tl.content,
       tl.created_at                                                  AS layer_created_at,
       tl.updated_at                                                  AS layer_updated_at,

       t.created_at,
       t.updated_at,

       COALESCE((SELECT anchor_total_depth FROM anchor_meta), -1) + 1 AS timeline_depth
FROM enriched e
         JOIN turns t ON t.id = e.id
         LEFT JOIN turn_layers tl ON tl.turn_id = e.id AND tl.key = ${params.layer}
-- UI wants root->leaf *within this page*:
ORDER BY e.depth DESC;
    `
  );
}

export async function getTurnContentLayers(
  db: SqliteDatabase,
  turnIds: string[]
): Promise<{ turnId: string; contentLayers: Record<string, string> }[]> {
  if (turnIds.length === 0) return [];

  const result = await db.query.turns.findMany({
    columns: { id: true },
    where: { id: { in: turnIds } },
    with: { layers: { columns: { key: true, content: true } } },
  });

  // Group content by turn ID and key
  // Results in an object like
  // {
  //   turnId1: { presentation: "content1", planning: "content2" },
  //   turnId2: { presentation: "content3", planning: "content4" },
  //   ...
  // }
  return result.map((turn) => ({
    turnId: turn.id,
    contentLayers: Object.fromEntries(
      turn.layers.map(({ key, content }) => [key, content])
    ),
  }));
}
