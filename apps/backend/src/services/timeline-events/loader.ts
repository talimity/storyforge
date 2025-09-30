import type { SqliteTxLike } from "@storyforge/db";
import type { RawTimelineEvent, TimelineEventDataLoader } from "@storyforge/timeline-events";
import { sql } from "drizzle-orm";

export class TimelineEventLoader implements TimelineEventDataLoader {
  constructor(private readonly db: SqliteTxLike) {}

  async loadOrderedEventsAlongPath(
    scenarioId: string,
    leafTurnId: string | null
  ): Promise<RawTimelineEvent[]> {
    return this.db.all<RawTimelineEvent>(sql`
WITH RECURSIVE
    leaf AS (SELECT COALESCE(${leafTurnId}, (SELECT anchor_turn_id FROM scenarios WHERE id = ${scenarioId})) AS id),
    path AS (SELECT t.id, 0 AS depth, t.parent_turn_id
             FROM turns t
             WHERE t.id = (SELECT id FROM leaf)
               AND t.scenario_id = ${scenarioId}
             UNION ALL
             SELECT p.id, path.depth + 1, p.parent_turn_id
             FROM turns p
                      JOIN path ON path.parent_turn_id = p.id
             WHERE p.scenario_id = ${scenarioId}),
    meta AS (SELECT COALESCE(MAX(depth), -1) AS max_depth FROM path),
    ordered_events AS (
      SELECT e.id,
             e.turn_id         AS turnId,
             e.order_key       AS orderKey,
             e.kind,
             e.payload_version AS payloadVersion,
             e.payload,
             COALESCE(t.is_ghost, 0)                                    AS turnIsGhost,
             CASE
               WHEN e.turn_id IS NULL THEN -1
               ELSE meta.max_depth - path.depth
             END AS event_depth
      FROM timeline_events e
               LEFT JOIN path ON path.id = e.turn_id
               LEFT JOIN turns t ON t.id = e.turn_id
               CROSS JOIN meta
      WHERE e.scenario_id = ${scenarioId}
        AND (e.turn_id IS NULL OR path.id IS NOT NULL)
    )
SELECT id,
       turnId,
       orderKey,
       kind,
       payloadVersion,
       payload,
       turnIsGhost
FROM ordered_events
ORDER BY event_depth ASC,
         orderKey ASC;
    `);
  }

  async loadEventsForTurns(scenarioId: string, turnIds: readonly string[]) {
    if (turnIds.length === 0) return [];
    const literals = turnIds.map((t) => sql`${t}`);
    return this.db.all<RawTimelineEvent>(sql`
        SELECT e.id,
               e.turn_id         AS turnId,
               e.order_key       AS orderKey,
               e.kind,
               e.payload_version AS payloadVersion,
               e.payload,
               COALESCE(t.is_ghost, 0) AS turnIsGhost
        FROM timeline_events e
                 LEFT JOIN turns t ON t.id = e.turn_id
        WHERE e.scenario_id = ${scenarioId}
          AND e.turn_id IN (${sql.join(literals, sql`, `)})
        ORDER BY e.turn_id,
                 e.order_key;
    `);
  }
}
