import {
  type SqliteDatabase,
  type SqliteTransaction,
  schema,
} from "@storyforge/db";
import { and, eq } from "drizzle-orm";
import { ServiceError } from "@/service-error";

const { turnLayers: tTurnLayers, turns: tTurns } = schema;

interface UpdateTurnContentArgs {
  turnId: string;
  layer: string;
  content: string;
}

/**
 * Manages turn content operations that don't affect the turn graph structure.
 * For structural changes (create, delete, reorder), use TimelineService.
 */
export class TurnContentService {
  constructor(private db: SqliteDatabase) {}

  /**
   * Updates the content of a specific layer for a turn, or creates it if it
   * doesn't exist.
   */
  async updateTurnContent(
    args: UpdateTurnContentArgs,
    outerTx?: SqliteTransaction
  ) {
    const { turnId, layer, content } = args;

    const operation = async (tx: SqliteTransaction) => {
      const [turn] = await tx
        .select({ id: tTurns.id })
        .from(tTurns)
        .where(eq(tTurns.id, turnId))
        .limit(1);

      if (!turn) {
        throw new ServiceError("NotFound", {
          message: `Turn with ID ${turnId} not found.`,
        });
      }

      const [existingLayer] = await tx
        .select()
        .from(tTurnLayers)
        .where(and(eq(tTurnLayers.turnId, turnId), eq(tTurnLayers.key, layer)))
        .limit(1);

      if (existingLayer) {
        // Update existing layer
        await tx
          .update(tTurnLayers)
          .set({ content, updatedAt: new Date() })
          .where(
            and(eq(tTurnLayers.turnId, turnId), eq(tTurnLayers.key, layer))
          );
      } else {
        // Create new layer
        await tx.insert(tTurnLayers).values({ turnId, key: layer, content });
      }

      const [updatedTurn] = await tx
        .select({
          id: tTurns.id,
          scenarioId: tTurns.scenarioId,
          chapterId: tTurns.chapterId,
          parentTurnId: tTurns.parentTurnId,
          authorParticipantId: tTurns.authorParticipantId,
          createdAt: tTurns.createdAt,
          updatedAt: tTurns.updatedAt,
        })
        .from(tTurns)
        .where(eq(tTurns.id, turnId))
        .limit(1);

      const [updatedLayer] = await tx
        .select()
        .from(tTurnLayers)
        .where(and(eq(tTurnLayers.turnId, turnId), eq(tTurnLayers.key, layer)))
        .limit(1);

      return { turn: updatedTurn, layer: updatedLayer };
    };

    return outerTx ? operation(outerTx) : this.db.transaction(operation);
  }
}
