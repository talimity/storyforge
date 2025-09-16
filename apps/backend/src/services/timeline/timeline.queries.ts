import type { IntentKind, IntentStatus } from "@storyforge/contracts";
import type { Intent, SqliteDatabase, SqliteTxLike } from "@storyforge/db";
import type { TurnCtxDTO } from "@storyforge/gentasks";
import { sql } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { getTurnIntentPrompt } from "../intent/utils/intent-prompts.js";
import { resolveLeafFrom } from "./utils/leaf.js";

type TimelineRow = {
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

  timeline_depth: number; // Depth from root to view anchor, 1-based

  intent_id: string | null;
  intent_kind: IntentKind | null;
  intent_status: IntentStatus | null;
  intent_sequence: number | null;
  intent_effect_count: number | null;
  intent_input_text: string | null;
  intent_target_participant_id: string | null;
};

/**
 * Fetches a window of the timeline *t* for a scenario.
 *
 * Definitions
 * - Timeline = a path from the scenario root node to a leaf node.
 * - View anchor = `leafTurnId`: the leaf node whose root→leaf path defines *t*.
 * - Page cursor = `cursorTurnId`: the node where this page starts.
 *
 * Behavior
 * - If `leafTurnId` is null/omitted, the view anchor defaults to the scenario's `anchor_turn_id`.
 * - If `cursorTurnId` is null/omitted or not on *t*, it is coerced to the view anchor.
 * - The page contains up to `windowSize` consecutive turns along *t* starting at `cursorTurnId` and walking toward the root (inclusive).
 * - Results are returned ordered root towards leaf within the page.
 * - Only turns on *t* are included; siblings are not included, but swipe metadata is computed for each returned turn:
 *   `left_turn_id`, `right_turn_id`, `swipe_count`, `swipe_no`.
 * - `turn_no` is the 1-based index of the turn along t (root = 1), and `timeline_depth` is the total length of *t* (root→view anchor).
 * - `content` corresponds to the requested `layer` (default `"presentation"`).
 * - The next-page cursor for infinite scrolling is the `parent_turn_id` of the first row, or `null` if the root is reached.
 *
 * @returns Array<TimelineRow> ordered root→leaf within the page.
 */
export async function getTimelineWindow(
  db: SqliteDatabase,
  args: {
    /** Scenario to query. */
    scenarioId: string;
    /** Optional view anchor (leaf) that defines the path t. Defaults to scenario.anchor_turn_id. */
    leafTurnId?: string | null;
    /** Optional page start node. Defaults to `leafTurnId` (or the scenario anchor). Coerced onto t if off-path. */
    cursorTurnId?: string | null;
    /** Number of turns to include (>= 1). */
    windowSize: number;
    /** Turn layer key to load; default "presentation". */
    layer?: string;
  }
): Promise<TimelineRow[]> {
  const { scenarioId, leafTurnId, cursorTurnId, windowSize, layer = "presentation" } = args;

  const params = {
    scenarioId,
    windowSize,
    anchorLeafId: leafTurnId ?? null, // "view anchor" for this window
    cursorId: cursorTurnId ?? null, // page start (may be off-path; coerced below)
    layer,
  };

  return db.all<TimelineRow>(sql`
WITH RECURSIVE
    -- 0) Resolve the view anchor leaf id for this window.
    view_leaf AS (SELECT COALESCE(
                                 ${params.anchorLeafId},
                                 (SELECT anchor_turn_id FROM scenarios WHERE id = ${params.scenarioId})
                         ) AS id),

    -- 1) Anchor chain for this view: leaf -> ... -> root.
    anchor AS (SELECT t.id, t.parent_turn_id, 0 AS depth_from_anchor
               FROM turns t
               WHERE t.id = (SELECT id FROM view_leaf)
                 AND t.scenario_id = ${params.scenarioId}
               UNION ALL
               SELECT p.id, p.parent_turn_id, a.depth_from_anchor + 1
               FROM turns p
                        JOIN anchor a ON a.parent_turn_id = p.id
               WHERE p.scenario_id = ${params.scenarioId}),
    anchor_meta AS (SELECT MAX(depth_from_anchor) AS anchor_total_depth
                    FROM anchor),

    -- 2) Choose a page cursor that lies on the anchor path.
    -- If the requested cursor isn't on the anchor path, fall back to the view leaf.
    page_cursor AS (SELECT COALESCE(
                                   (SELECT a.id FROM anchor a WHERE a.id = ${params.cursorId}),
                                   (SELECT id FROM view_leaf)
                           ) AS id),

    -- 3) Build the page chain: cursor -> ... -> root (leaf->root order in this CTE).
    page AS (SELECT t.id, t.parent_turn_id, 0 AS depth
             FROM turns t
             WHERE t.id = (SELECT id FROM page_cursor)
               AND t.scenario_id = ${params.scenarioId}
             UNION ALL
             SELECT p.id, p.parent_turn_id, pg.depth + 1
             FROM turns p
                      JOIN page pg ON pg.parent_turn_id = p.id
             WHERE p.scenario_id = ${params.scenarioId}),

    -- 4) Limit to the requested window.
    paged AS (SELECT *
              FROM page
              ORDER BY depth -- leaf->root for paging
              LIMIT ${params.windowSize}),

    -- 5) Sibling info for all parents represented in this page.
    siblings AS (SELECT s.id,
                        LAG(s.id) OVER (PARTITION BY s.parent_turn_id ORDER BY s.sibling_order)    AS prev_sibling_id,
                        LEAD(s.id) OVER (PARTITION BY s.parent_turn_id ORDER BY s.sibling_order)   AS next_sibling_id,
                        COUNT(*) OVER (PARTITION BY s.parent_turn_id)                              AS sibling_count,
                        ROW_NUMBER() OVER (PARTITION BY s.parent_turn_id ORDER BY s.sibling_order) AS sibling_index_1
                 FROM turns s
                 WHERE s.scenario_id = ${params.scenarioId}
                   AND s.parent_turn_id IN (SELECT parent_turn_id
                                            FROM paged
                                            WHERE parent_turn_id IS NOT NULL)),

    -- 6) Gather intent metadata for turns in this page window.
    intent_effects_page AS (SELECT ie.turn_id,
                                   ie.intent_id,
                                   ie.sequence,
                                   COUNT(*) OVER (PARTITION BY ie.intent_id) AS effect_count
                            FROM intent_effects ie
                            WHERE ie.turn_id IN (SELECT id FROM paged)
                              AND ie.kind = 'new_turn'),
    intent_meta AS (SELECT ie.turn_id,
                           ie.intent_id,
                           ie.sequence,
                           ie.effect_count,
                           i.kind       AS intent_kind,
                           i.status     AS intent_status,
                           i.target_participant_id,
                           i.input_text
                    FROM intent_effects_page ie
                             LEFT JOIN intents i ON i.id = ie.intent_id),

    -- 7) Enrich: compute turn_no relative to the *view anchor* path and
    -- filter to rows that are actually on that path.
    enriched AS (SELECT pg.id,
                        pg.parent_turn_id,
                        pg.depth, -- page-local depth (leaf=0..)
                        a.depth_from_anchor,
                        (am.anchor_total_depth - a.depth_from_anchor + 1) AS turn_no,
                        sb.prev_sibling_id,
                        sb.next_sibling_id,
                        COALESCE(sb.sibling_count, 1)                     AS swipe_count,
                        COALESCE(sb.sibling_index_1, 1)                   AS swipe_no,
                         id.intent_id,
                         id.intent_kind,
                         id.intent_status,
                         id.sequence,
                         id.effect_count,
                         id.target_participant_id,
                         id.input_text
                 FROM paged pg
                          JOIN anchor a ON a.id = pg.id -- drop any rows not on the view anchor path
                          CROSS JOIN anchor_meta am
                          LEFT JOIN siblings sb ON sb.id = pg.id
                          LEFT JOIN intent_meta id ON id.turn_id = pg.id)

SELECT e.id,
       t.scenario_id,
       t.chapter_id,
       e.parent_turn_id,
       t.author_participant_id,

       e.prev_sibling_id                                              AS left_turn_id,
       e.next_sibling_id                                              AS right_turn_id,
       e.swipe_count,
       e.swipe_no,

       e.turn_no, -- 1-based position relative to view anchor root

       tl.content,
       tl.created_at                                                  AS layer_created_at,
       tl.updated_at                                                  AS layer_updated_at,

       t.created_at,
       t.updated_at,

       COALESCE((SELECT anchor_total_depth FROM anchor_meta), -1) + 1 AS timeline_depth,

       e.intent_id,
       e.intent_kind,
       e.intent_status,
       e.sequence                                                     AS intent_sequence,
       e.effect_count                                                  AS intent_effect_count,
       e.input_text                                                    AS intent_input_text,
       e.target_participant_id                                         AS intent_target_participant_id
FROM enriched e
         JOIN turns t ON t.id = e.id
         LEFT JOIN turn_layers tl ON tl.turn_id = e.id AND tl.key = ${params.layer}
-- UI wants root->leaf *within this page*:
ORDER BY e.depth DESC;
  `);
}
/**
 * Get the content of all layers for the given turn IDs.
 */
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
    contentLayers: Object.fromEntries(turn.layers.map(({ key, content }) => [key, content])),
  }));
}

/**
 * Return the full timeline path (root -> selected leaf) with all content
 * layers, mapped to TurnCtxDTO. If leafTurnId is null, uses the scenario's
 * anchor_turn_id.
 */
export async function getFullTimelineTurnCtx(
  db: SqliteTxLike,
  args: {
    leafTurnId: string | null;
    scenarioId: string;
  }
): Promise<TurnCtxDTO[]> {
  const { leafTurnId, scenarioId } = args;

  // We build the entire parent chain from leaf to root (depth 0..N), compute
  // the total depth, and then derive 1-based turn numbers as (total_depth -
  // depth). All layers are aggregated in-SQL via json_group_object;
  // presentation content is extracted via a conditional aggregate for direct
  // access.
  const rows = await db.all<{
    turn_no: number;
    author_name: string;
    author_type: "character" | "narrator";
    presentation: string | null;
    layers_json: string | null;
    intent_id: string | null;
    intent_kind: Intent["kind"] | null;
    intent_input_text: string | null;
    intent_target_participant_id: string | null;
  }>(sql`WITH RECURSIVE
    scenario_anchor AS (SELECT anchor_turn_id AS id
                        FROM scenarios
                        WHERE id = ${scenarioId}),
    -- starting leaf (explicit leaf or scenario anchor)
    start_leaf AS (SELECT COALESCE(${leafTurnId}, (SELECT id FROM scenario_anchor)) AS id),
    -- walk from selected leaf up to root
    path AS (SELECT t.id, t.parent_turn_id, 0 AS depth
             FROM turns t
             WHERE t.id = (SELECT id FROM start_leaf)
               AND t.scenario_id = ${scenarioId}
             UNION ALL
             SELECT p.id, p.parent_turn_id, path.depth + 1
             FROM turns p
                      JOIN path ON path.parent_turn_id = p.id
             WHERE p.scenario_id = ${scenarioId}),
    meta AS (SELECT MAX(depth) AS max_depth
             FROM path),
    -- enrich with author info and layer aggregates
    enriched AS (SELECT t.id,
                        -- 1-based turn number where root=1 .. leaf=max_depth+1
                        ((SELECT max_depth FROM meta) - p.depth + 1)               AS turn_no,
                        -- author display (Narrator vs Character name)
                        CASE sp.type
                            WHEN 'narrator' THEN 'Narrator'
                            ELSE COALESCE(c.name, 'Unknown')
                            END                                                    AS author_name,
                        CASE sp.type
                            WHEN 'narrator' THEN 'narrator'
                            ELSE 'character'
                            END                                                    AS author_type,
                        -- presentation layer content
                        MAX(CASE WHEN tl.key = 'presentation' THEN tl.content END) AS presentation,
                        -- aggregate all layers into a single JSON object
                        json_group_object(tl.key, tl.content)                      AS layers_json
                 FROM path p
                          JOIN turns t ON t.id = p.id
                          JOIN scenario_participants sp ON sp.id = t.author_participant_id
                          LEFT JOIN characters c ON c.id = sp.character_id
                          LEFT JOIN turn_layers tl ON tl.turn_id = t.id
                 GROUP BY t.id, p.depth, sp.type, c.name),
    -- get intents for each turn
    intent_map AS (SELECT ie.turn_id,
                          i.id                    AS intent_id,
                          i.kind                  AS intent_kind,
                          i.input_text            AS intent_input_text,
                          i.target_participant_id AS intent_target_participant_id
                   FROM intent_effects ie
                            JOIN intents i ON i.id = ie.intent_id AND i.scenario_id = ${scenarioId}
                   WHERE ie.kind = 'new_turn')
SELECT e.turn_no, e.author_name, e.author_type, e.presentation, e.layers_json,
       im.intent_id, im.intent_kind, im.intent_input_text, im.intent_target_participant_id
FROM enriched e
LEFT JOIN intent_map im ON im.turn_id = e.id
ORDER BY turn_no ASC;
  `);

  // Shape to TurnCtxDTO
  return rows.map((r) => ({
    turnNo: r.turn_no,
    authorName: r.author_name,
    authorType: r.author_type,
    content: r.presentation ?? "",
    layers: r.layers_json ? JSON.parse(r.layers_json) : {},
    intent: getTurnIntentPrompt({
      kind: r.intent_kind,
      targetName: r.author_name, // TODO: in the future it may not always be the turn author
      text: r.intent_input_text,
    }),
  }));
}

/** Resolve deepest leaf id under a given turn id within a scenario, after validating membership. */
export async function resolveLeafForScenario(
  db: SqliteDatabase,
  args: { scenarioId: string; fromTurnId: string }
): Promise<string> {
  const { scenarioId, fromTurnId } = args;
  // Validate the turn belongs to scenario
  const t = await db.query.turns.findFirst({
    where: { id: fromTurnId, scenarioId },
    columns: { id: true },
  });

  if (!t) {
    throw new ServiceError("NotFound", {
      message: `Turn ${fromTurnId} not found in scenario ${scenarioId}`,
    });
  }

  return resolveLeafFrom(db, fromTurnId);
}
