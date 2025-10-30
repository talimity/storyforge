import { type SqliteDatabase, sqliteTimestampToDate } from "@storyforge/db";
import { sql } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { resolveLeafFrom } from "./utils/leaf.js";

export async function getTimelineBranchMap(
  db: SqliteDatabase,
  args: { scenarioId: string; focusTurnId?: string }
) {
  const { scenarioId, focusTurnId } = args;

  const scenario = await db.get<{
    anchor_turn_id: string | null;
    root_turn_id: string | null;
  }>(sql`
      SELECT
          s.anchor_turn_id,
          (
              SELECT t.id
              FROM turns t
              WHERE t.scenario_id = s.id AND t.parent_turn_id IS NULL
              LIMIT 1
          ) AS root_turn_id
      FROM scenarios s
      WHERE s.id = ${scenarioId};
  `);

  if (!scenario) {
    throw new ServiceError("NotFound", {
      message: `Scenario with ID ${scenarioId} not found.`,
    });
  }

  const anchorTurnId = scenario.anchor_turn_id;
  const rootTurnId = scenario.root_turn_id;

  let focusLeafId: string | null = null;
  if (focusTurnId) {
    const focusCandidate = await db.get<{ id: string }>(sql`
      SELECT id
      FROM turns
      WHERE id = ${focusTurnId} AND scenario_id = ${scenarioId}
      LIMIT 1;
    `);
    if (focusCandidate) {
      focusLeafId = await resolveLeafFrom(db, focusTurnId, { strategy: "mostRecentUpdated" });
    }
  }

  let pathToAnchor: string[] = [];
  if (anchorTurnId) {
    const pathRows = await db.all<{ id: string }>(sql`
        WITH RECURSIVE path AS (
            SELECT t.id, t.parent_turn_id, 0 AS depth
            FROM turns t
            WHERE t.id = ${anchorTurnId} AND t.scenario_id = ${scenarioId}
            UNION ALL
            SELECT parent.id, parent.parent_turn_id, path.depth + 1
            FROM turns parent
                     JOIN path ON path.parent_turn_id = parent.id
            WHERE parent.scenario_id = ${scenarioId}
        )
        SELECT id
        FROM path
        ORDER BY depth DESC;
    `);
    pathToAnchor = pathRows.map((row) => row.id);
  }

  const nodeRows = await db.all<{
    id: string;
    parent_id: string | null;
    author_participant_id: string;
    is_ghost: number;
    sibling_order: string;
    created_at: number;
    updated_at: number;
    child_count: number;
    branching_child_count: number;
    depth: number;
    leaf_count: number;
    selected_leaf_count: number;
    is_leaf: number;
  }>(sql`
      WITH filtered_turns AS (
          SELECT
              id,
              parent_turn_id,
              author_participant_id,
              is_ghost,
              sibling_order,
              created_at,
              updated_at
          FROM turns
          WHERE scenario_id = ${scenarioId}
      ),
           depths AS (
               SELECT id, 0 AS depth
               FROM filtered_turns
               WHERE parent_turn_id IS NULL

               UNION ALL

               SELECT child.id, parent.depth + 1 AS depth
               FROM filtered_turns child
                        JOIN depths parent ON child.parent_turn_id = parent.id
           ),
           child_stats AS (
               SELECT
                   child.parent_turn_id AS parent_id,
                   COUNT(*) AS child_count,
                   SUM(
                           CASE
                               WHEN EXISTS (
                                   SELECT 1
                                   FROM filtered_turns grandchild
                                   WHERE grandchild.parent_turn_id = child.id
                               ) THEN 1
                               ELSE 0
                               END
                   ) AS branching_child_count
               FROM filtered_turns child
               GROUP BY child.parent_turn_id
           ),
           leaf_children AS (
               SELECT ft.*
               FROM filtered_turns ft
               WHERE NOT EXISTS (
                   SELECT 1 FROM filtered_turns grandchild WHERE grandchild.parent_turn_id = ft.id
               )
           ),
           primary_leaf_candidates AS (
               SELECT lc.*
               FROM leaf_children lc
                        JOIN (
                   SELECT parent_turn_id, MIN(sibling_order) AS first_order
                   FROM leaf_children
                   GROUP BY parent_turn_id
               ) pick ON pick.parent_turn_id = lc.parent_turn_id AND lc.sibling_order = pick.first_order
           ),
          anchor_leaf AS (
              SELECT lc.*
              FROM leaf_children lc
              WHERE lc.id = ${anchorTurnId}
           ),
           focus_leaf AS (
               SELECT lc.*
               FROM leaf_children lc
               WHERE lc.id = ${focusLeafId}
           ),
           selected_leaves AS (
               SELECT id, parent_turn_id FROM primary_leaf_candidates
               UNION
               SELECT id, parent_turn_id FROM anchor_leaf
               UNION
               SELECT id, parent_turn_id FROM focus_leaf
           ),
           selected_leaf_counts AS (
               SELECT parent_turn_id AS parent_id, COUNT(*) AS selected_leaf_count
               FROM selected_leaves
               GROUP BY parent_turn_id
           ),
           interior_nodes AS (
               SELECT
                   ft.id,
                   ft.parent_turn_id,
                   ft.author_participant_id,
                   ft.is_ghost,
                   ft.sibling_order,
                   ft.created_at,
                   ft.updated_at,
                   cs.child_count,
                   cs.branching_child_count,
                   COALESCE(d.depth, 0) AS depth,
                   (cs.child_count - cs.branching_child_count) AS leaf_count,
                   COALESCE(sel.selected_leaf_count, 0) AS selected_leaf_count
               FROM filtered_turns ft
                        JOIN child_stats cs ON cs.parent_id = ft.id
                        LEFT JOIN selected_leaf_counts sel ON sel.parent_id = ft.id
                        LEFT JOIN depths d ON d.id = ft.id
               WHERE cs.child_count > 0
           ),
           leaf_nodes AS (
               SELECT
                   lc.id,
                   lc.parent_turn_id,
                   lc.author_participant_id,
                   lc.is_ghost,
                   lc.sibling_order,
                   lc.created_at,
                   lc.updated_at,
                   COALESCE(d.depth, 0) AS depth
               FROM leaf_children lc
                        JOIN selected_leaves sl ON sl.id = lc.id
                        LEFT JOIN depths d ON d.id = lc.id
           )
      SELECT
          i.id,
          i.parent_turn_id AS parent_id,
          i.author_participant_id,
          i.is_ghost,
          i.sibling_order,
          i.created_at,
          i.updated_at,
          i.child_count,
          i.branching_child_count,
          i.depth,
          i.leaf_count,
          i.selected_leaf_count,
          0 AS is_leaf
      FROM interior_nodes i

      UNION ALL

      SELECT
          l.id,
          l.parent_turn_id AS parent_id,
          l.author_participant_id,
          l.is_ghost,
          l.sibling_order,
          l.created_at,
          l.updated_at,
          0 AS child_count,
          0 AS branching_child_count,
          l.depth,
          0 AS leaf_count,
          0 AS selected_leaf_count,
          1 AS is_leaf
      FROM leaf_nodes l

      ORDER BY depth, created_at;
  `);

  const pathSet = new Set(pathToAnchor);

  const nodes = nodeRows.map((row) => {
    const childCount = Number(row.child_count ?? 0);
    const branchingChildCount = Number(row.branching_child_count ?? 0);
    const leafCount = Number(row.leaf_count ?? 0);
    const selectedLeafCount = Number(row.selected_leaf_count ?? 0);
    const collapsedLeafChildCount = row.is_leaf ? 0 : Math.max(leafCount - selectedLeafCount, 0);
    return {
      id: row.id,
      parentId: row.parent_id,
      authorParticipantId: row.author_participant_id,
      isGhost: Boolean(row.is_ghost),
      siblingOrder: row.sibling_order,
      childCount,
      branchingChildCount,
      collapsedLeafChildCount,
      createdAt: sqliteTimestampToDate(row.created_at),
      updatedAt: sqliteTimestampToDate(row.updated_at),
      onActivePath: pathSet.has(row.id),
      depth: row.depth,
      turnNumber: row.depth + 1,
    };
  });

  const edgeRows = await db.all<{
    source: string;
    target: string;
    edge_order: string;
  }>(sql`
      WITH filtered_turns AS (
          SELECT
              id,
              parent_turn_id,
              author_participant_id,
              is_ghost,
              sibling_order,
              created_at,
              updated_at
          FROM turns
          WHERE scenario_id = ${scenarioId}
      ),
           depths AS (
               SELECT id, 0 AS depth
               FROM filtered_turns
               WHERE parent_turn_id IS NULL

               UNION ALL

               SELECT child.id, parent.depth + 1 AS depth
               FROM filtered_turns child
                        JOIN depths parent ON child.parent_turn_id = parent.id
           ),
           child_stats AS (
               SELECT
                   child.parent_turn_id AS parent_id,
                   COUNT(*) AS child_count,
                   SUM(
                           CASE
                               WHEN EXISTS (
                                   SELECT 1
                                   FROM filtered_turns grandchild
                                   WHERE grandchild.parent_turn_id = child.id
                               ) THEN 1
                               ELSE 0
                               END
                   ) AS branching_child_count
               FROM filtered_turns child
               GROUP BY child.parent_turn_id
           ),
           leaf_children AS (
               SELECT ft.*
               FROM filtered_turns ft
               WHERE NOT EXISTS (
                   SELECT 1 FROM filtered_turns grandchild WHERE grandchild.parent_turn_id = ft.id
               )
           ),
           primary_leaf_candidates AS (
               SELECT lc.*
               FROM leaf_children lc
                        JOIN (
                   SELECT parent_turn_id, MIN(sibling_order) AS first_order
                   FROM leaf_children
                   GROUP BY parent_turn_id
               ) pick ON pick.parent_turn_id = lc.parent_turn_id AND lc.sibling_order = pick.first_order
           ),
          anchor_leaf AS (
              SELECT lc.*
              FROM leaf_children lc
              WHERE lc.id = ${anchorTurnId}
          ),
          focus_leaf AS (
              SELECT lc.*
              FROM leaf_children lc
              WHERE lc.id = ${focusLeafId}
          ),
          selected_leaves AS (
              SELECT id, parent_turn_id, sibling_order FROM primary_leaf_candidates
              UNION
              SELECT id, parent_turn_id, sibling_order FROM anchor_leaf
              UNION
              SELECT id, parent_turn_id, sibling_order FROM focus_leaf
          ),
           interior_nodes AS (
               SELECT
                   ft.id,
                   ft.parent_turn_id,
                   ft.sibling_order,
                   cs.child_count,
                   COALESCE(d.depth, 0) AS depth
               FROM filtered_turns ft
                        JOIN child_stats cs ON cs.parent_id = ft.id
                        LEFT JOIN depths d ON d.id = ft.id
               WHERE cs.child_count > 0
           ),
           leaf_nodes AS (
               SELECT sl.id, sl.parent_turn_id, sl.sibling_order
               FROM selected_leaves sl
           )
      SELECT
          parent.id AS source,
          child.id AS target,
          child.sibling_order AS edge_order
      FROM interior_nodes parent
               JOIN interior_nodes child ON child.parent_turn_id = parent.id

      UNION ALL

      SELECT
          parent.id AS source,
          leaf.id AS target,
          leaf.sibling_order AS edge_order
      FROM interior_nodes parent
               JOIN leaf_nodes leaf ON leaf.parent_turn_id = parent.id

      ORDER BY source, edge_order;
  `);

  return {
    scenarioId,
    rootTurnId,
    anchorTurnId,
    pathToAnchor,
    nodes,
    edges: edgeRows.map((row) => ({
      source: row.source,
      target: row.target,
      order: row.edge_order,
    })),
  };
}
