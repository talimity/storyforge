import { type SqliteTxLike, schema } from "@storyforge/db";
import {
  type LorebookAssignment,
  normalizeLorebookData,
  parseLorebookData,
} from "@storyforge/lorebooks";
import { asc, eq } from "drizzle-orm";

export async function loadScenarioLorebookAssignments(
  db: SqliteTxLike,
  scenarioId: string
): Promise<LorebookAssignment[]> {
  const rows = await db
    .select({
      lorebookId: schema.lorebooks.id,
      data: schema.lorebooks.data,
      enabled: schema.scenarioLorebooks.enabled,
      orderIndex: schema.scenarioLorebooks.orderIndex,
    })
    .from(schema.scenarioLorebooks)
    .innerJoin(schema.lorebooks, eq(schema.scenarioLorebooks.lorebookId, schema.lorebooks.id))
    .where(eq(schema.scenarioLorebooks.scenarioId, scenarioId))
    .orderBy(asc(schema.scenarioLorebooks.orderIndex), asc(schema.lorebooks.name));

  return rows.map((row) => ({
    lorebookId: row.lorebookId,
    orderIndex: row.orderIndex,
    enabled: row.enabled,
    data: normalizeLorebookData(parseLorebookData(row.data)),
  }));
}
