import {
  type SqliteDatabase,
  type SqliteTransaction,
  schema,
} from "@storyforge/db";
import { after, combine } from "@storyforge/utils";
import { asc, eq, isNull, sql } from "drizzle-orm";
import { EngineError } from "../../engine-error.js";
import { ServiceError } from "../../service-error.js";
import { canCreateTurn, canPromoteChildren } from "./invariants/turn.js";
import { validateTurnLayers } from "./invariants/turn-content.js";
import { canAppendTurnToChapter } from "./invariants/turn-progression.js";
import {
  type DeletionSnapshot,
  executeDeletionPlan,
  planDeletion,
  type TurnGraphDeleteMode,
} from "./utils/mutation-planner.js";

const {
  chapters: tChapters,
  scenarios: tScenarios,
  scenarioParticipants: tScenarioParticipants,
  turns: tTurns,
  turnLayers: tTurnLayers,
} = schema;

const makeLoaders = (tx: SqliteTransaction) => ({
  loadChapter: (id: string) =>
    tx.select().from(tChapters).where(eq(tChapters.id, id)).limit(1).get(),
  loadTurn: (id: string) =>
    tx.select().from(tTurns).where(eq(tTurns.id, id)).limit(1).get(),
  loadAuthorParticipant: (id: string) => loadParticipantMembership(tx, id),
});

interface InsertTurnArgs {
  scenarioId: string;
  authorParticipantId: string;
  chapterId: string;
  parentTurnId: string | null; // null for root creation
  layers: { key: string; content: string }[];
}

interface AdvanceTurnArgs
  extends Omit<InsertTurnArgs, "parentTurnId" | "chapterId"> {
  /** If not provided, will use the chapter of the anchor turn */
  chapterId?: string;
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
    const { scenarioId } = args;
    const operation = async (tx: SqliteTransaction) => {
      const [scenario] = await tx
        .select()
        .from(tScenarios)
        .where(eq(tScenarios.id, scenarioId))
        .limit(1);
      if (!scenario) {
        throw new ServiceError("NotFound", {
          message: `Scenario with ID ${scenarioId} not found.`,
        });
      }

      const { anchorTurnId } = scenario;
      let targetChapterId: string;
      let parentTurnId: string | null;

      // Determine the target chapter and parent turn based on the scenario's
      // current progression. Caller can specify a chapterId if they intend to
      // create a the first turn of a new chapter.
      if (anchorTurnId) {
        const [anchorTurn] = await tx
          .select()
          .from(tTurns)
          .where(eq(tTurns.id, anchorTurnId))
          .limit(1);
        if (!anchorTurn) {
          throw new ServiceError("NotFound", {
            message: `Anchor turn with ID ${anchorTurnId} not found in scenario ${scenarioId}.`,
          });
        }

        targetChapterId = args.chapterId ?? anchorTurn.chapterId;
        parentTurnId = anchorTurnId;
      } else {
        // This is the first turn in the scenario, so we need to find the
        // first chapter to insert into.
        const [firstChapter] = await tx
          .select()
          .from(tChapters)
          .where(eq(tChapters.scenarioId, scenarioId))
          .orderBy(asc(tChapters.index))
          .limit(1);
        if (!firstChapter) {
          throw new ServiceError("NotFound", {
            message: `No chapters found for scenario ${scenarioId}.`,
          });
        }
        targetChapterId = firstChapter.id;
        parentTurnId = null;
      }

      const turn = await this.insertTurn(
        { ...args, chapterId: targetChapterId, parentTurnId },
        tx
      );

      // Since this is an advance operation, we need to update the anchor turn
      // to point to the new turn.
      await tx
        .update(tScenarios)
        .set({ anchorTurnId: turn.id })
        .where(eq(tScenarios.id, args.scenarioId));

      return turn;
    };
    return outerTx ? operation(outerTx) : this.db.transaction(operation);
  }

  async branchTurn() {
    // 1. Validate parent turn exists
    // 2. Insert turn with given parent turn ID
    // 3. Skip updating the anchor turn, as the new turn is not part of the
    //    scenario's active timeline (switching is a separate operation).
    // 4. ???
    throw new Error("Not implemented");
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

  async deleteTurn(
    turnId: string,
    cascade: boolean,
    outerTx?: SqliteTransaction
  ) {
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
    const [target] = await tx
      .select()
      .from(tTurns)
      .where(eq(tTurns.id, turnId))
      .limit(1);
    if (!target) {
      throw new ServiceError("NotFound", {
        message: `Turn with ID ${turnId} not found.`,
      });
    }

    const [scenario] = await tx
      .select()
      .from(tScenarios)
      .where(eq(tScenarios.id, target.scenarioId))
      .limit(1);
    if (!scenario) {
      throw new ServiceError("NotFound", {
        message: `Scenario with ID ${target.scenarioId} not found.`,
      });
    }

    const children = await tx
      .select()
      .from(tTurns)
      .where(eq(tTurns.parentTurnId, turnId))
      .orderBy(tTurns.siblingOrder)
      .all();

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
    const { scenarioId, chapterId, authorParticipantId, parentTurnId, layers } =
      args;

    const operation = async (tx: SqliteTransaction) => {
      const loaders = makeLoaders(tx);
      const check = combine(
        validateTurnLayers(layers),
        await canCreateTurn({ scenarioId, authorParticipantId, loaders }),
        await canAppendTurnToChapter({
          targetChapterId: chapterId,
          parentTurnId,
          scenarioId,
          loaders,
        })
      );
      if (!check.ok) throw new EngineError(check.error);

      // If another turn has this parent, we need to determine the sibling order
      const nextOrder = await nextSiblingOrder(tx, parentTurnId);

      // Insert turn and its content
      const [newTurn] = await tx
        .insert(schema.turns)
        .values({
          scenarioId,
          chapterId,
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
}

async function nextSiblingOrder(tx: SqliteTransaction, parent: string | null) {
  const rows = await tx
    .select({ order: schema.turns.siblingOrder })
    .from(schema.turns)
    .where(
      parent
        ? eq(schema.turns.parentTurnId, parent)
        : isNull(schema.turns.parentTurnId)
    )
    .orderBy(schema.turns.siblingOrder);

  const last = rows.at(-1)?.order ?? "";
  return after(last);
}

async function loadParticipantMembership(
  tx: SqliteTransaction,
  participantId: string
) {
  const [p] = await tx
    .select({
      id: tScenarioParticipants.id,
      scenarioId: tScenarioParticipants.scenarioId,
      status: tScenarioParticipants.status,
    })
    .from(tScenarioParticipants)
    .where(eq(tScenarioParticipants.id, participantId))
    .limit(1);
  if (!p) return;
  return { id: p.id, scenarioId: p.scenarioId, status: p.status };
}
