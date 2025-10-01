import { type SqliteDatabase, schema } from "@storyforge/db";
import { createId, ranksBetween } from "@storyforge/utils";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "../../../test/setup.js";
import { resolveLeafFrom } from "./leaf.js";

const TEST_SCENARIO_ID = "leaf-strategy-scenario";
const TEST_PARTICIPANT_ID = "leaf-strategy-participant";

const RANKS = ranksBetween("", "", 5);

describe("resolveLeafFrom", () => {
  let db: SqliteDatabase;

  beforeEach(async () => {
    db = await createTestDatabase();
    await db.insert(schema.scenarios).values({
      id: TEST_SCENARIO_ID,
      name: "Leaf Strategy",
      description: "Test scenario",
    });
    await db.insert(schema.scenarioParticipants).values({
      id: TEST_PARTICIPANT_ID,
      scenarioId: TEST_SCENARIO_ID,
    });
  });

  it("follows leftmost descendants by default", async () => {
    const root = await createTurn(db, { parent: null, siblingOrder: RANKS[0] });
    const leftChild = await createTurn(db, { parent: root.id, siblingOrder: RANKS[0] });
    await createTurn(db, { parent: leftChild.id, siblingOrder: RANKS[0] });
    await createTurn(db, { parent: root.id, siblingOrder: RANKS[1] });

    const leafId = await resolveLeafFrom(db, root.id);
    expect(leafId).toBe(await getDeepestChildId(db, leftChild.id));
  });

  it("selects path using most recent createdAt timestamps", async () => {
    const baseTime = new Date("2024-01-01T00:00:00.000Z");
    const root = await createTurn(db, {
      parent: null,
      siblingOrder: RANKS[0],
      timestamp: baseTime,
    });
    const olderBranch = await createTurn(db, {
      parent: root.id,
      siblingOrder: RANKS[0],
      timestamp: new Date(baseTime.getTime() + 1_000),
    });
    await createTurn(db, {
      parent: olderBranch.id,
      siblingOrder: RANKS[0],
      timestamp: new Date(baseTime.getTime() + 2_000),
    });

    const newerBranch = await createTurn(db, {
      parent: root.id,
      siblingOrder: RANKS[1],
      timestamp: new Date(baseTime.getTime() + 10_000),
    });
    const newerLeaf = await createTurn(db, {
      parent: newerBranch.id,
      siblingOrder: RANKS[0],
      timestamp: new Date(baseTime.getTime() + 11_000),
    });

    const leafId = await resolveLeafFrom(db, root.id, { strategy: "mostRecentCreated" });
    expect(leafId).toBe(newerLeaf.id);
  });

  it("uses updatedAt to follow the most recently touched branch", async () => {
    const baseTime = new Date("2024-01-01T00:00:00.000Z");
    const root = await createTurn(db, {
      parent: null,
      siblingOrder: RANKS[0],
      timestamp: baseTime,
    });

    const steadyBranch = await createTurn(db, {
      parent: root.id,
      siblingOrder: RANKS[0],
      timestamp: new Date(baseTime.getTime() + 1_000),
    });
    await createTurn(db, {
      parent: steadyBranch.id,
      siblingOrder: RANKS[0],
      timestamp: new Date(baseTime.getTime() + 2_000),
    });

    const revisitedBranch = await createTurn(db, {
      parent: root.id,
      siblingOrder: RANKS[1],
      timestamp: new Date(baseTime.getTime() + 3_000),
    });
    const revisitedLeaf = await createTurn(db, {
      parent: revisitedBranch.id,
      siblingOrder: RANKS[0],
      timestamp: new Date(baseTime.getTime() + 4_000),
    });

    const newerUpdate = new Date(baseTime.getTime() + 50_000);
    await db
      .update(schema.turns)
      .set({ updatedAt: newerUpdate })
      .where(eq(schema.turns.id, revisitedBranch.id));
    await db
      .update(schema.turns)
      .set({ updatedAt: new Date(newerUpdate.getTime() + 1_000) })
      .where(eq(schema.turns.id, revisitedLeaf.id));

    const leafId = await resolveLeafFrom(db, root.id, { strategy: "mostRecentUpdated" });
    expect(leafId).toBe(revisitedLeaf.id);
  });
});

async function createTurn(
  db: SqliteDatabase,
  opts: { parent: string | null; siblingOrder: string; timestamp?: Date }
) {
  const id = createId();
  const now = opts.timestamp ?? new Date();

  await db.insert(schema.turns).values({
    id,
    scenarioId: TEST_SCENARIO_ID,
    parentTurnId: opts.parent,
    siblingOrder: opts.siblingOrder,
    authorParticipantId: TEST_PARTICIPANT_ID,
    createdAt: now,
    updatedAt: now,
  });

  return { id };
}

async function getDeepestChildId(db: SqliteDatabase, fromId: string) {
  const row = await db
    .select({ id: schema.turns.id })
    .from(schema.turns)
    .where(eq(schema.turns.parentTurnId, fromId))
    .orderBy(schema.turns.siblingOrder)
    .limit(1)
    .get();
  if (!row) return fromId;
  return getDeepestChildId(db, row.id);
}
