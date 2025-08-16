import { type SqliteTransaction, schema } from "@storyforge/db";
import { eq, sql } from "drizzle-orm";

async function loadTurn(db: SqliteTransaction, turnId: string) {
  return db
    .select()
    .from(schema.turns)
    .where(eq(schema.turns.id, turnId))
    .limit(1)
    .get();
}

async function loadParticipantMembership(
  db: SqliteTransaction,
  participantId: string
) {
  const p = await db
    .select({
      id: schema.scenarioParticipants.id,
      scenarioId: schema.scenarioParticipants.scenarioId,
      isActive: sql<number>`unassigned_at IS NULL`.as("isActive"),
    })
    .from(schema.scenarioParticipants)
    .where(eq(schema.scenarioParticipants.id, participantId))
    .limit(1)
    .get();
  if (!p) return;
  return { id: p.id, scenarioId: p.scenarioId, isActive: !!p.isActive };
}

/**
 * Get the next dense sibling order under the given parent turn.
 */
async function nextSiblingOrder(
  db: SqliteTransaction,
  parentTurnId: string | null
) {
  const [r] = await db.all<{ max_order: number | null }>(sql`
      SELECT MAX(sibling_order) AS max_order
      FROM ${schema.turns}
      WHERE parent_turn_id ${parentTurnId ? sql`= ${parentTurnId}` : sql`IS NULL`}
    `);
  return (r?.max_order ?? -1) + 1;
}

async function insertTurn(
  db: SqliteTransaction,
  args: {
    scenarioId: string;
    chapterId: string;
    parentTurnId: string | null;
    siblingOrder: number;
    authorParticipantId: string;
  }
) {
  const turn = await db.insert(schema.turns).values(args).returning().get();
  if (!turn) throw new Error("Failed to insert turn");
  return turn;
}

export const TurnOps = {
  loadTurn,
  loadParticipantMembership,
  nextSiblingOrder,
  insertTurn,
};
