import type { SqliteDatabase, SqliteTransaction } from "@storyforge/db";
import { schema } from "@storyforge/db";
import { combine } from "@storyforge/utils";
import { eq } from "drizzle-orm";
import { EngineError } from "@/engine/engine-error";
import { canCreateTurn } from "@/engine/invariants/turn";
import { canAppendTurnToChapter } from "@/engine/invariants/turn-progression";
import { ChapterOps } from "@/library/chapter/chapter.ops";
import { TurnOps } from "@/library/turn/turn.ops";

const createTxLoaders = (tx: SqliteTransaction) => ({
  loadChapter: (id: string) => ChapterOps.loadChapter(tx, id),
  loadTurn: (id: string) => TurnOps.loadTurn(tx, id),
  loadAuthorParticipant: (id: string) =>
    TurnOps.loadParticipantMembership(tx, id),
});

/**
 * Manages mutations to the turn graph, which is a tree structure
 * representing the progression of a scenario.
 */
export class TimelineService {
  constructor(private db: SqliteDatabase) {}

  /**
   * Advance the turn graph by creating a new turn under the specified parent.
   * This is used for both root creation and advancing existing turns.
   */
  async advanceTurn(args: {
    scenarioId: string;
    authorParticipantId: string;
    chapterId: string;
    parentTurnId: string | null; // null for root creation
  }) {
    const { scenarioId, chapterId, authorParticipantId, parentTurnId } = args;
    return this.db.transaction(async (tx) => {
      const loaders = createTxLoaders(tx);
      const validation = combine(
        await canCreateTurn({ scenarioId, authorParticipantId, loaders }),
        await canAppendTurnToChapter({
          targetChapterId: chapterId,
          parentTurnId,
          scenarioId,
          loaders,
        })
      );
      if (!validation.ok) {
        throw new EngineError(validation.error);
      }

      const nextOrder = await TurnOps.nextSiblingOrder(tx, parentTurnId);
      const newTurn = await TurnOps.insertTurn(tx, {
        scenarioId,
        chapterId,
        parentTurnId,
        siblingOrder: nextOrder,
        authorParticipantId,
      });

      // Update the scenario's anchor turn
      await tx
        .update(schema.scenarios)
        .set({ anchorTurnId: newTurn.id })
        .where(eq(schema.scenarios.id, scenarioId))
        .get();

      return newTurn;
    });
  }

  /**
   * Create a branch by appending under an arbitrary ancestor, then set it current.
   */
  async branchFrom(_args: {
    scenarioId: string;
    chapterId: string;
    authorParticipantId: string;
    branchParentTurnId: string; // the node to branch from
  }) {}

  /**
   * Ensure a root exists for a scenario (idempotent).
   */
  // TODO: this should be a composable operation
  // ensureRootTurn(args: {
  //   scenarioId: string;
  //   chapterId: string;
  //   authorParticipantId: string;
  // }) {
  //   return this.db.transaction((tx) => {
  //     const root = tx
  //       .select()
  //       .from(schema.turns)
  //       .where(
  //         and(
  //           eq(schema.turns.scenarioId, args.scenarioId),
  //           isNull(schema.turns.parentTurnId)
  //         )
  //       )
  //       .limit(1)
  //       .get();
  //
  //     if (root) return root;
  //
  //     return this.advanceTurn({
  //       scenarioId: args.scenarioId,
  //       chapterId: args.chapterId,
  //       authorParticipantId: args.authorParticipantId,
  //       parentTurnId: null,
  //     });
  //   });
  // }
}
