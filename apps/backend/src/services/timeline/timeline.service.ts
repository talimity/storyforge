import { type SqliteDatabase, type SqliteTransaction, schema } from "@storyforge/db";
import { after, combine } from "@storyforge/utils";
import { eq, isNull, sql } from "drizzle-orm";
import { EngineError } from "../../engine-error.js";
import { ServiceError } from "../../service-error.js";
import { withTransaction } from "../../transaction-utils.js";
import { getGeneratingIntent } from "../intent/intent.queries.js";
import { canCreateTurn, canPromoteChildren } from "./invariants/turn.js";
import { validateTurnLayers } from "./invariants/turn-content.js";
import { resolveLeafFrom } from "./utils/leaf.js";
import {
  type DeletionSnapshot,
  executeDeletionPlan,
  planDeletion,
  type TurnGraphDeleteMode,
} from "./utils/mutation-planner.js";

const { scenarios: tScenarios, turns: tTurns, turnLayers: tTurnLayers } = schema;

const makeLoaders = (tx: SqliteTransaction) => ({
  loadTurn: (id: string) => tx.select().from(tTurns).where(eq(tTurns.id, id)).limit(1).get(),
  loadAuthorParticipant: (id: string) => loadParticipantMembership(tx, id),
});

interface InsertTurnArgs {
  scenarioId: string;
  authorParticipantId: string;
  parentTurnId: string | null; // null for root creation
  layers: { key: string; content: string }[];
}

interface AdvanceTurnArgs extends Omit<InsertTurnArgs, "parentTurnId"> {
  /** When provided, insert under this parent instead of continuing from anchor */
  branchFromTurnId?: string;
}

interface InsertTurnAfterArgs extends Omit<InsertTurnArgs, "parentTurnId"> {
  targetTurnId: string;
}

interface SwitchAnchorArgs {
  scenarioId: string;
  fromTurnId: string;
}

/**
 * Manages mutations to the turn graph, which is a tree structure
 * representing the progression of a scenario.
 */
export class TimelineService {
  constructor(private db: SqliteDatabase) {}

  /**
   * Advances the turn graph by adding a new turn at the end of the scenario's
   * active timeline.
   */
  async advanceTurn(args: AdvanceTurnArgs, outerTx?: SqliteTransaction) {
    const { scenarioId, branchFromTurnId } = args;
    const operation = async (tx: SqliteTransaction) => {
      await this.getScenarioOrThrow(tx, scenarioId);

      const parentTurnId = await this.getParentTurnIdForAdvance(tx, scenarioId, branchFromTurnId);

      const { branchFromTurnId: _, ...rest } = args;
      const turn = await this.insertTurn({ ...rest, parentTurnId }, tx);

      // Since this is an advance operation, the new turn becomes the scenario's
      // active timeline anchor.
      await tx
        .update(tScenarios)
        .set({ anchorTurnId: turn.id })
        .where(eq(tScenarios.id, args.scenarioId));

      return turn;
    };
    return withTransaction(this.db, outerTx, operation);
  }

  /**
   * Inserts a new turn immediately after the given target turn within the same branch.
   * Any existing children of the target are reparented to the newly inserted turn,
   * preserving their relative sibling order. If the target turn is the scenario's
   * anchor, the anchor is updated to the new turn to maintain the leaf invariant.
   */
  async insertTurnAfter(args: InsertTurnAfterArgs, outerTx?: SqliteTransaction) {
    const { scenarioId, targetTurnId, authorParticipantId, layers } = args;
    const op = async (tx: SqliteTransaction) => {
      const scenario = await this.getScenarioOrThrow(tx, scenarioId);
      await this.getTurnInScenarioOrThrow(tx, targetTurnId, scenarioId);

      const existingChildren = await tx.query.turns.findMany({
        columns: { id: true },
        where: { parentTurnId: targetTurnId },
        orderBy: (t) => [t.siblingOrder],
      });

      const newTurn = await this.insertTurn(
        {
          scenarioId,
          authorParticipantId,
          parentTurnId: targetTurnId,
          layers,
        },
        tx
      );

      if (existingChildren.length > 0) {
        let orderCursor = "";
        for (const child of existingChildren) {
          orderCursor = after(orderCursor);
          await tx
            .update(tTurns)
            .set({
              parentTurnId: newTurn.id,
              siblingOrder: orderCursor,
              updatedAt: new Date(),
            })
            .where(eq(tTurns.id, child.id));
        }
      }

      if (scenario.anchorTurnId === targetTurnId) {
        await tx
          .update(tScenarios)
          .set({ anchorTurnId: newTurn.id })
          .where(eq(tScenarios.id, scenarioId));
      }

      return newTurn;
    };

    return withTransaction(this.db, outerTx, op);
  }

  async setTurnGhostState(args: { turnId: string; isGhost: boolean }) {
    const { turnId, isGhost } = args;

    await this.db.transaction(async (tx) => {
      await this.getTurnOrThrow(tx, turnId);

      await tx.update(tTurns).set({ isGhost, updatedAt: new Date() }).where(eq(tTurns.id, turnId));
    });
  }

  /**
   * Determines the parent of a turn to be inserted into the turn graph. Raises
   * an error if a branching operation is attempted on an empty scenario.
   */
  private async getParentTurnIdForAdvance(
    _tx: SqliteTransaction,
    scenarioId: string,
    branchFromTurnId?: string
  ): Promise<string | null> {
    if (branchFromTurnId) {
      // We are advancing from a turn earlier in the scenario, thereby creating
      // a branch. The branch point is the parent.
      return branchFromTurnId;
    }

    // No branch point provided, so we are advancing the active timeline
    // (appending to anchor, or creating a root).
    const scenario = await this.db.query.scenarios.findFirst({
      columns: { anchorTurnId: true },
      where: { id: scenarioId },
    });

    if (!scenario?.anchorTurnId) {
      // No anchor turn, so we are creating a root.
      return null;
    }
    return scenario.anchorTurnId;
  }

  async reorderTurn(_delta: number) {
    // 1. Validate turn exists & abs(delta) <= 1
    // 2. Iteratively walk up/down graph to find target turn
    //   - If no parent or no child, raise error
    // 3. Find any sibling turns and set their parents to this turn's current parent
    // 4. Unlink the turn from its current position
    //   - If it is the anchor turn, move the anchor to current parent
    //   - If it is not the anchor turn, find child and set their parent to current parent
    // 5. Reinsert the turn at the new position
    //   - If target turn has a parent, use that parent for this turn's new parent
    //   - If any other turns have the same parent, set this turn's new sibling order
    // 6. Set target turn's parent to this turn
    throw new Error("Not implemented");
  }

  async deleteTurn(turnId: string, cascade: boolean, outerTx?: SqliteTransaction) {
    const mode: TurnGraphDeleteMode = cascade ? "cascade" : "promote";
    const op = async (tx: SqliteTransaction) => {
      const snapshot = await this.loadDeletionSnapshot(tx, turnId, mode);

      // check invariants before planning
      if (mode === "promote") {
        const check = canPromoteChildren({
          turn: snapshot.target,
          childCount: snapshot.children.length,
        });
        if (!check.ok) throw new EngineError(check.error);
      }

      const plan = planDeletion(snapshot, mode);
      await executeDeletionPlan(tx, plan, snapshot.scenario.id);
    };
    return outerTx ? op(outerTx) : this.db.transaction(op);
  }

  private async loadDeletionSnapshot(
    tx: SqliteTransaction,
    turnId: string,
    mode: TurnGraphDeleteMode
  ): Promise<DeletionSnapshot> {
    const target = await this.getTurnOrThrow(tx, turnId);
    const scenario = await this.getScenarioOrThrow(tx, target.scenarioId);

    const children = await tx.query.turns.findMany({
      where: { parentTurnId: turnId },
      orderBy: (t) => [t.siblingOrder],
    });

    const siblings = await tx
      .select({ id: tTurns.id, order: tTurns.siblingOrder })
      .from(tTurns)
      .where(
        target.parentTurnId
          ? eq(tTurns.parentTurnId, target.parentTurnId)
          : isNull(tTurns.parentTurnId)
      )
      .orderBy(tTurns.siblingOrder)
      .all();

    let descendants: string[] | undefined;
    if (mode === "cascade") {
      const rows = await tx.all<{ id: string }>(sql`
      WITH RECURSIVE d AS (
        SELECT id FROM ${tTurns} WHERE id = ${turnId}
        UNION ALL
        SELECT t.id FROM ${tTurns} t JOIN d ON t.parent_turn_id = d.id
      ) SELECT id FROM d;`);
      descendants = rows.map((r) => r.id);
    }

    return { scenario, target, children, siblings, descendants };
  }

  /**
   * Inserts a new turn into the turn graph under the specified parent turn.
   */
  private async insertTurn(args: InsertTurnArgs, outerTx?: SqliteTransaction) {
    const { scenarioId, authorParticipantId, parentTurnId, layers } = args;

    const operation = async (tx: SqliteTransaction) => {
      const loaders = makeLoaders(tx);
      const check = combine(
        validateTurnLayers(layers),
        await canCreateTurn({ scenarioId, authorParticipantId, loaders })
      );
      if (!check.ok) throw new EngineError(check.error);

      // If another turn has this parent, we need to determine the sibling order
      const nextOrder = await nextSiblingOrder(tx, parentTurnId);

      // Insert turn and its content
      const [newTurn] = await tx
        .insert(schema.turns)
        .values({
          scenarioId,
          parentTurnId,
          siblingOrder: String(nextOrder),
          authorParticipantId,
        })
        .returning();
      const turnId = newTurn.id;
      await tx
        .insert(tTurnLayers)
        .values(layers.map(({ key, content }) => ({ turnId, key, content })));

      return newTurn;
    };
    return outerTx ? operation(outerTx) : this.db.transaction(operation);
  }

  /**
   * Switch the scenario's active timeline anchor to the leaf node under
   * `fromTurnId`. Raises an error if there is an active intent generation for
   * the scenario.
   *
   * Returns the ID of the scenario's new anchor turn.
   */
  async switchAnchor(args: SwitchAnchorArgs, outerTx?: SqliteTransaction) {
    const { scenarioId, fromTurnId } = args;
    const op = async (tx: SqliteTransaction) => {
      // Ensure fromTurnId exists and belongs to scenario
      const turn = await tx.query.turns.findFirst({ where: { id: fromTurnId, scenarioId } });
      if (!turn) {
        throw new ServiceError("NotFound", {
          message: `Turn with ID ${fromTurnId} not found.`,
        });
      }

      // Guard against switching while generating
      const pendingIntent = await getGeneratingIntent(tx, scenarioId);
      if (pendingIntent) {
        throw new ServiceError("Conflict", {
          message: `Cannot switch scenario anchor while intent generation is in progress.`,
        });
      }

      const leafId = await resolveLeafFrom(tx, fromTurnId, {
        strategy: "mostRecentUpdated",
      });
      await tx
        .update(tScenarios)
        .set({ anchorTurnId: leafId })
        .where(eq(tScenarios.id, scenarioId));
      return leafId;
    };
    return outerTx ? op(outerTx) : this.db.transaction(op);
  }

  private async getScenarioOrThrow(tx: SqliteTransaction, scenarioId: string) {
    const scenario = await tx.query.scenarios.findFirst({ where: { id: scenarioId } });

    if (!scenario) {
      throw new ServiceError("NotFound", {
        message: `Scenario with ID ${scenarioId} not found.`,
      });
    }

    return scenario;
  }

  private async getTurnOrThrow(tx: SqliteTransaction, turnId: string) {
    const turn = await tx.query.turns.findFirst({ where: { id: turnId } });

    if (!turn) {
      throw new ServiceError("NotFound", {
        message: `Turn with ID ${turnId} not found.`,
      });
    }

    return turn;
  }

  private async getTurnInScenarioOrThrow(
    tx: SqliteTransaction,
    turnId: string,
    scenarioId: string
  ) {
    const turn = await this.getTurnOrThrow(tx, turnId);
    if (turn.scenarioId !== scenarioId) {
      throw new ServiceError("NotFound", {
        message: `Turn with ID ${turnId} not found in scenario ${scenarioId}.`,
      });
    }
    return turn;
  }
}

async function nextSiblingOrder(tx: SqliteTransaction, parent: string | null) {
  const rows = await tx.query.turns.findMany({
    columns: { siblingOrder: true },
    where: {
      ...(parent ? { parentTurnId: parent } : { parentTurnId: { isNull: true } }),
    },
    orderBy: (t) => [t.siblingOrder],
  });

  const last = rows.at(-1)?.siblingOrder ?? "";
  return after(last);
}

async function loadParticipantMembership(tx: SqliteTransaction, participantId: string) {
  const p = await tx.query.scenarioParticipants.findFirst({
    columns: { id: true, scenarioId: true, status: true },
    where: { id: participantId },
  });
  if (!p) return;
  return { id: p.id, scenarioId: p.scenarioId, status: p.status };
}
