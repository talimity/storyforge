import type { StoryforgeSqliteDatabase } from "@storyforge/db";
import { schema } from "@storyforge/db";
import { and, eq, isNull, sql } from "drizzle-orm";

export class TurnWriteService {
  constructor(private db: StoryforgeSqliteDatabase) {}

  /**
   * Append a new child turn under the given parent (the current leaf by default),
   * set its sibling order correctly, and update the scenario's current_turn_id.
   */
  async advanceTurn(args: {
    scenarioId: string;
    chapterId: string;
    authorParticipantId: string;
    parentTurnId: string | null; // null for root creation
  }) {
    const { scenarioId, chapterId, authorParticipantId, parentTurnId } = args;

    return this.db.transaction(async (tx) => {
      // Validate participant belongs to scenario (cheap safety check)
      const participant = await tx
        .select({ id: schema.scenarioParticipants.id })
        .from(schema.scenarioParticipants)
        .where(
          and(
            eq(schema.scenarioParticipants.id, authorParticipantId),
            eq(schema.scenarioParticipants.scenarioId, scenarioId)
          )
        )
        .limit(1);
      if (participant.length === 0)
        throw new Error("Author participant does not belong to scenario");

      // Compute next sibling order under the parent
      const [maxRow] = tx.all<{ max_order: number | null }>(sql`
        SELECT MAX(sibling_order) AS max_order
        FROM ${schema.turns}
        WHERE parent_turn_id ${parentTurnId ? sql`= ${parentTurnId}` : sql`IS NULL`}
      `);
      const nextOrder = (maxRow?.max_order ?? -1) + 1;

      // Insert the turn
      const [turn] = await tx
        .insert(schema.turns)
        .values({
          scenarioId,
          chapterId,
          parentTurnId: parentTurnId ?? null,
          siblingOrder: nextOrder,
          authorParticipantId,
        })
        .returning();

      if (!turn) throw new Error("Failed to insert turn");

      // Update the scenario's current_turn_id if the column exists in your schema.
      // If it doesn't yet, keep this as a TODO and remove this update.
      try {
        await tx
          .update(schema.scenarios)
          .set({ currentTurnId: turn.id })
          .where(eq(schema.scenarios.id, scenarioId));
      } catch {
        // no-op until the column is present
      }

      return turn;
    });
  }

  /**
   * Create a branch by appending under an arbitrary ancestor, then set it current.
   */
  async branchFrom(args: {
    scenarioId: string;
    chapterId: string;
    authorParticipantId: string;
    branchParentTurnId: string; // the node to branch from
  }) {
    return this.advanceTurn({
      scenarioId: args.scenarioId,
      chapterId: args.chapterId,
      authorParticipantId: args.authorParticipantId,
      parentTurnId: args.branchParentTurnId,
    });
  }

  /**
   * Ensure a root exists for a scenario (idempotent).
   */
  async ensureRootTurn(args: {
    scenarioId: string;
    chapterId: string;
    authorParticipantId: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [root] = await tx
        .select()
        .from(schema.turns)
        .where(
          and(
            eq(schema.turns.scenarioId, args.scenarioId),
            isNull(schema.turns.parentTurnId)
          )
        )
        .limit(1);

      if (root) return root;

      return await this.advanceTurn({
        scenarioId: args.scenarioId,
        chapterId: args.chapterId,
        authorParticipantId: args.authorParticipantId,
        parentTurnId: null,
      });
    });
  }
}
