import {
  type IntentKind,
  type IntentStatus,
  type TimelineEvent,
  timelineEventSchema,
} from "@storyforge/contracts";
import type { Intent, SqliteDatabase, SqliteTxLike } from "@storyforge/db";
import type { TurnCtxDTO } from "@storyforge/gentasks";
import { sql } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { getTurnIntentPrompt } from "../intent/utils/intent-prompts.js";
import { TimelineStateService } from "../timeline-events/timeline-state.service.js";
import { eventDTOsByTurn } from "../timeline-events/utils/event-dtos.js";
import { resolveLeafFrom } from "./utils/leaf.js";

type TimelineRowRecord = {
  id: string;
  scenario_id: string;
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

  timeline_length: number; // Length of entire timeline the query is scoped to

  intent_id: string | null;
  intent_kind: IntentKind | null;
  intent_status: IntentStatus | null;
  intent_sequence: number | null;
  intent_effect_count: number | null;
  intent_input_text: string | null;
  intent_target_participant_id: string | null;
};

type TimelineRow = TimelineRowRecord & {
  events: TimelineEvent[];
};

/**
 * Traverse a scenario's turn tree along a timeline path *t* to return a slice
 * of turns along the path.
 *
 * Definitions
 * - Timeline = a path from the scenario root node to a leaf node
 * - Leaf turn = `leafTurnId`: the leaf node whose root->leaf path defines *t*
 * - Page cursor = `cursorTurnId`: the node where this page starts
 *
 * Behavior
 * - If `leafTurnId` is null/omitted, the scenario's `anchor_turn_id` is used as
 *   the leaf turn
 * - If `cursorTurnId` is null/omitted or not on *t*, the leaf turn is used as
 *   the start of the page
 * - The page contains up to `windowSize` consecutive turns along *t* starting
 *   at `cursorTurnId` and walking toward the root (inclusive)
 * - Results are returned ordered chronologically (so, root towards leaf) within
 *   the page window
 * - Only turns on *t* are included; siblings are not included, but swipe
 *   metadata is computed for each returned turn: `left_turn_id`,
 *   `right_turn_id`, `swipe_count`, `swipe_no`
 * - `turn_no` is the 1-based index of the turn along *t* (root = 1), and
 *   `timeline_depth` is the total length of *t* (root..leaf)
 * - `content` corresponds to the requested `layer` (default `"presentation"`)
 * - The next-page cursor for infinite scrolling is the `parent_turn_id` of the
 *   first row, or `null` if the root is reached
 *
 * @returns Array<TimelineRow> ordered root->leaf within the page
 */
export async function getTimelineWindow(
  db: SqliteDatabase,
  args: {
    /**
     * Scenario to filter timeline by.
     */
    scenarioId: string;
    /**
     * Optional leaf that starts the path *t* towards the root. Defaults to
     * scenario `anchor_turn_id`.
     */
    leafTurnId?: string | null;
    /**
     * Optional page start node. Defaults to `leafTurnId` (or the scenario
     * anchor).
     */
    cursorTurnId?: string | null;
    /**
     * Number of turns to include in the page
     */
    windowSize: number;
    /**
     * Turn layer key to load; default "presentation"
     */
    layer?: string;
  }
): Promise<TimelineRow[]> {
  const {
    scenarioId,
    leafTurnId = null,
    cursorTurnId = null,
    windowSize,
    layer = "presentation",
  } = args;

  const params = { scenarioId, windowSize, leafTurnId, cursorTurnId, layer };
  const query = sql`WITH RECURSIVE
    -- 0) Resolve the target leaf turn ID, using scenario anchor turn if no alternate leaf node provided
    leaf_turn AS (SELECT COALESCE(
                                 ${params.leafTurnId},
                                 (SELECT anchor_turn_id FROM scenarios WHERE id = ${params.scenarioId})
                         ) AS id),

    -- 1) Full timeline path from target leaf -> ... -> scenario root
    full_path AS (SELECT ts.id, ts.parent_turn_id, 0 AS depth_from_leaf
                  FROM turns ts
                  WHERE ts.id = (SELECT id FROM leaf_turn)
                    AND ts.scenario_id = ${params.scenarioId}
                  UNION ALL
                  SELECT tr.id, tr.parent_turn_id, fp.depth_from_leaf + 1
                  FROM turns tr
                           JOIN full_path fp ON fp.parent_turn_id = tr.id
                  WHERE tr.scenario_id = ${params.scenarioId}),
    -- 1.1) Compute the total length of the timeline path, for use in turn_no computation
    full_path_meta AS (SELECT MAX(depth_from_leaf) + 1 AS timeline_len
                       FROM full_path),

    -- 2) Choose a page cursor that lies on the path.
    -- If the requested cursor isn't on the path, fall back to the target leaf turn.
    page_cursor AS (SELECT COALESCE(
                                   (SELECT p.id FROM full_path p WHERE p.id = ${params.cursorTurnId}),
                                   (SELECT id FROM leaf_turn)
                           ) AS id),

    -- 3) Build the page path (subset of full timeline path, from cursor to cursor+windowSize)
    cursor_depth AS (SELECT fp.depth_from_leaf AS d
                     FROM full_path fp
                     WHERE fp.id = (SELECT id FROM page_cursor)),
    paged_path AS (SELECT fp.id, fp.parent_turn_id, fp.depth_from_leaf
                   FROM full_path fp,
                        cursor_depth cd
                   WHERE fp.depth_from_leaf >= cd.d -- from cursor upward (toward root)
                   ORDER BY fp.depth_from_leaf --  d, d+1, d+2, ...
                   LIMIT ${params.windowSize}),

    -- 4) Sibling info for all parents in this page window.
    siblings AS (SELECT ts.id,
                        LAG(ts.id) OVER (PARTITION BY ts.parent_turn_id ORDER BY ts.sibling_order)   AS prev_sibling_id,
                        LEAD(ts.id) OVER (PARTITION BY ts.parent_turn_id ORDER BY ts.sibling_order)  AS next_sibling_id,
                        COUNT(*) OVER (PARTITION BY ts.parent_turn_id)                               AS sibling_count,
                        ROW_NUMBER() OVER (PARTITION BY ts.parent_turn_id ORDER BY ts.sibling_order) AS sibling_index_1
                 FROM turns ts
                 WHERE ts.scenario_id = ${params.scenarioId}
                   AND ts.parent_turn_id IN (SELECT parent_turn_id
                                             FROM paged_path
                                             WHERE parent_turn_id IS NOT NULL)),

    -- 5) Gather intent metadata for turns in this page window.
    effects AS (SELECT ie.turn_id,
                       ie.intent_id,
                       ie.sequence,
                       COUNT(*) OVER (PARTITION BY ie.intent_id) AS effect_count
                FROM intent_effects ie
                WHERE ie.turn_id IN (SELECT id FROM paged_path)
                  AND ie.kind = 'new_turn'),
    intent_meta AS (SELECT ef.turn_id,
                           ef.intent_id,
                           ef.sequence,
                           ef.effect_count,
                           i.kind   AS intent_kind,
                           i.status AS intent_status,
                           i.target_participant_id,
                           i.input_text
                    FROM effects ef
                             LEFT JOIN intents i ON i.id = ef.intent_id),

    -- 6) Enrich: compute turn_no relative to the target leaf
    enriched AS (SELECT pp.id,
                        pp.parent_turn_id,
                        fp.depth_from_leaf,                                 -- full timeline depth; 0(leaf)..total_depth(root)
                        (fpm.timeline_len - fp.depth_from_leaf) AS turn_no, -- essentially reverse the path numbering
                        st.prev_sibling_id,
                        st.next_sibling_id,
                        COALESCE(st.sibling_count, 1)           AS swipe_count,
                        COALESCE(st.sibling_index_1, 1)         AS swipe_no,
                        im.intent_id,
                        im.intent_kind,
                        im.intent_status,
                        im.sequence,
                        im.effect_count,
                        im.target_participant_id,
                        im.input_text
                 FROM paged_path pp
                          JOIN full_path fp ON fp.id = pp.id
                          CROSS JOIN full_path_meta fpm
                          LEFT JOIN siblings st ON st.id = pp.id
                          LEFT JOIN intent_meta im ON im.turn_id = pp.id)

SELECT e.id,
       t.scenario_id,
       e.parent_turn_id,
       t.author_participant_id,

       e.prev_sibling_id                                      AS left_turn_id,
       e.next_sibling_id                                      AS right_turn_id,
       e.swipe_count,
       e.swipe_no,

       e.turn_no, -- 1-based, ordered from root towards leaf

       tl.content,
       tl.created_at                                          AS layer_created_at,
       tl.updated_at                                          AS layer_updated_at,

       t.created_at,
       t.updated_at,

       COALESCE((SELECT timeline_len FROM full_path_meta), 0) AS timeline_length,

       e.intent_id,
       e.intent_kind,
       e.intent_status,
       e.sequence                                             AS intent_sequence,
       e.effect_count                                         AS intent_effect_count,
       e.input_text                                           AS intent_input_text,
       e.target_participant_id                                AS intent_target_participant_id
FROM enriched e
         JOIN turns t ON t.id = e.id
         LEFT JOIN turn_layers tl ON tl.turn_id = e.id AND tl.key = ${params.layer}
ORDER BY e.turn_no;
  `;

  const stateService = new TimelineStateService(db);
  const [rows, derivation] = await Promise.all([
    db.all<TimelineRowRecord>(query),
    stateService.deriveState(scenarioId, leafTurnId),
  ]);

  if (rows.length === 0) {
    return [];
  }

  const eventsByTurn = eventDTOsByTurn(derivation.events);

  return rows.map((row) => {
    const untypedEvents = eventsByTurn[row.id] ?? [];
    return {
      ...row,
      events: untypedEvents.map((ev) => timelineEventSchema.parse(ev)),
    };
  });
}

export async function getAuthorHistoryWindow(
  db: SqliteDatabase,
  args: { scenarioId: string; leafTurnId?: string | null; windowSize: number }
): Promise<string[]> {
  const { scenarioId, leafTurnId = null, windowSize } = args;

  const rows = await db.all<{ author_participant_id: string }>(sql`
    WITH RECURSIVE
      leaf AS (
        SELECT COALESCE(${leafTurnId}, (SELECT anchor_turn_id FROM scenarios WHERE id = ${scenarioId})) AS id
      ),
      path AS (
        SELECT t.id, 0 AS depth, t.parent_turn_id
          FROM turns t
         WHERE t.id = (SELECT id FROM leaf) AND t.scenario_id = ${scenarioId}
        UNION ALL
        SELECT parent.id, path.depth + 1, parent.parent_turn_id
          FROM turns parent
          JOIN path ON path.parent_turn_id = parent.id
         WHERE parent.scenario_id = ${scenarioId}
      ),
      limited AS (
        SELECT id, depth
          FROM path
         ORDER BY depth ASC
         LIMIT ${windowSize}
      )
    SELECT turns.author_participant_id
      FROM limited
      JOIN turns ON turns.id = limited.id
     ORDER BY limited.depth ASC;
  `);

  return rows.map((row) => row.author_participant_id);
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
  args: { leafTurnId: string | null; scenarioId: string }
): Promise<Omit<TurnCtxDTO, "events">[]> {
  const { leafTurnId, scenarioId } = args;

  // We build the entire parent chain from leaf to root (depth 0..N), compute
  // the total depth, and then derive 1-based turn numbers as (total_depth -
  // depth). All layers are aggregated in-SQL via json_group_object;
  // presentation content is extracted via a conditional aggregate for direct
  // access.
  const rows = await db.all<{
    turn_id: string;
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
                        MAX(CASE WHEN l.key = 'presentation' THEN l.content END) AS presentation,
                        -- aggregate all layers into a single JSON object
                        json_group_object(l.key, l.content)                      AS layers_json
                 FROM path p
                          JOIN turns t ON t.id = p.id
                          JOIN scenario_participants sp ON sp.id = t.author_participant_id
                          LEFT JOIN characters c ON c.id = sp.character_id
                          LEFT JOIN turn_layers l ON l.turn_id = t.id
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
SELECT e.id AS turn_id,
       e.turn_no,
       e.author_name,
       e.author_type,
       e.presentation,
       e.layers_json,
       im.intent_id,
       im.intent_kind,
       im.intent_input_text,
       im.intent_target_participant_id
FROM enriched e
LEFT JOIN intent_map im ON im.turn_id = e.id
ORDER BY turn_no ASC;
  `);

  // Shape to TurnCtxDTO
  return rows.map((r) => {
    const layers = r.layers_json ? JSON.parse(r.layers_json) : {};

    return {
      turnId: r.turn_id,
      turnNo: r.turn_no,
      authorName: r.author_name,
      authorType: r.author_type,
      content: r.presentation ?? "",
      layers,
      intent: getTurnIntentPrompt({
        kind: r.intent_kind,
        targetName: r.author_name,
        text: r.intent_input_text,
      }),
    };
  });
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
