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
             WHERE p.scenario_id = ${scenarioId})
SELECT e.id,
       e.turn_id         AS turnId,
       e.position,
       e.order_key       AS orderKey,
       e.kind,
       e.payload_version AS payloadVersion,
       e.payload
FROM timeline_events e
         JOIN path ON path.id = e.turn_id
WHERE e.scenario_id = ${scenarioId}
ORDER BY path.depth ASC,
         CASE e.position WHEN 'before' THEN 0 ELSE 1 END ASC,
         e.order_key ASC;
    `);
  }

  async loadEventsForTurns(scenarioId: string, turnIds: readonly string[]) {
    if (turnIds.length === 0) return [];
    const literals = turnIds.map((t) => sql`${t}`);
    return this.db.all<RawTimelineEvent>(sql`
        SELECT e.id,
               e.turn_id         AS turnId,
               e.position,
               e.order_key       AS orderKey,
               e.kind,
               e.payload_version AS payloadVersion,
               e.payload
        FROM timeline_events e
        WHERE e.scenario_id = ${scenarioId}
          AND e.turn_id IN (${sql.join(literals, sql`, `)})
        ORDER BY e.turn_id,
                 CASE e.position WHEN 'before' THEN 0 ELSE 1 END,
                 e.order_key;
    `);
  }
}
