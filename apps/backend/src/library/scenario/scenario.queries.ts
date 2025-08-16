import { type StoryforgeSqliteDatabase, schema } from "@storyforge/db";
import { sql } from "drizzle-orm";
import { scenarioCharaSummaryColumns } from "@/library/selectors";

export type ScenarioOverview = Awaited<ReturnType<typeof listScenarios>>[0];

export type ScenarioDetail = Awaited<ReturnType<typeof getScenarioDetail>>;

export async function listScenarios(
  db: StoryforgeSqliteDatabase,
  filters: { status?: "active" | "archived" }
) {
  const { status } = filters;

  return db.query.scenarios.findMany({
    columns: {
      id: true,
      name: true,
      description: true,
      status: true,
      settings: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
    where: { status },
    with: {
      participants: {
        columns: { id: true, role: true, orderIndex: true },
        with: { character: scenarioCharaSummaryColumns },
        orderBy: (p) => [p.orderIndex],
      },
    },
  });
}

export async function scenarioExists(
  db: StoryforgeSqliteDatabase,
  scenarioId: string
) {
  const scenario = await db
    .select()
    .from(schema.scenarios)
    .where(sql`${schema.scenarios.id} = ${scenarioId}`)
    .limit(1);
  return scenario.length > 0;
}

export async function getScenarioDetail(
  db: StoryforgeSqliteDatabase,
  scenarioId: string
) {
  return db.query.scenarios.findFirst({
    where: { id: scenarioId },
    with: {
      chapters: true,
      participants: {
        columns: { id: true, role: true, orderIndex: true },
        with: { character: scenarioCharaSummaryColumns },
        orderBy: (p) => [p.orderIndex],
      },
    },
  });
}
