import type { SqliteDatabase } from "@storyforge/db";
import { isDefined } from "@storyforge/utils";
import { sql } from "drizzle-orm";
import { getCharaAssetPaths } from "@/library/character/utils/chara-asset-helpers";
import { scenarioCharaSummaryColumns } from "@/library/selectors";

export type ScenarioOverview = Awaited<ReturnType<typeof listScenarios>>[0];

export async function listScenarios(
  db: SqliteDatabase,
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

export type ScenarioDetail = Awaited<ReturnType<typeof getScenarioDetail>>;

export async function getScenarioDetail(
  db: SqliteDatabase,
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

export type ScenarioBootstrap = Awaited<
  ReturnType<typeof getScenarioBootstrap>
>;

/**
 * Fetches all necessary data to bootstrap the Scenario Player environment.
 */
export async function getScenarioBootstrap(
  db: SqliteDatabase,
  scenarioId: string
) {
  const result = await db.query.scenarios.findFirst({
    where: { id: scenarioId },
    columns: { id: true, name: true, rootTurnId: true, anchorTurnId: true },
    with: {
      participants: {
        columns: { id: true, type: true, status: true, characterId: true },
        orderBy: (p) => [p.orderIndex],
        with: {
          character: {
            columns: { id: true, name: true },
            extras: { hasPortrait: sql<number>`portrait IS NOT NULL` },
          },
        },
      },
      chapters: {
        columns: { id: true, index: true, name: true },
        orderBy: (c) => [c.index],
      },
    },
  });

  if (!result) {
    throw new Error(`Scenario with id ${scenarioId} not found`);
  }

  // Transform the data to match the API contract
  return {
    scenario: {
      id: result.id,
      title: result.name,
      rootTurnId: result.rootTurnId,
      anchorTurnId: result.anchorTurnId,
    },
    participants: result.participants.map((p) => ({
      id: p.id,
      type: p.type,
      status: p.status,
      characterId: p.characterId,
    })),
    characters: result.participants
      .map((p) => p.character)
      .filter(isDefined)
      .map((c) => ({ id: c.id, name: c.name, ...getCharaAssetPaths(c) })),
    chapters: result.chapters.map((c) => ({
      id: c.id,
      index: c.index,
      title: c.name,
    })),
    generatingIntent: null, // TODO: Implement when intent system is ready
  };
}
