import { type SqliteDatabase, type SqliteTransaction, schema } from "@storyforge/db";
import { chapterBreakSpec, presenceChangeSpec } from "@storyforge/timeline-events";
import { after } from "@storyforge/utils";
import { and, eq, sql } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";

const { timelineEvents, turns, scenarioParticipants } = schema;

export interface InsertChapterBreakArgs {
  scenarioId: string;
  turnId: string;
  nextChapterTitle: string;
}

export interface InsertPresenceChangeArgs {
  scenarioId: string;
  turnId: string;
  participantId: string;
  active: boolean;
  status?: string | null;
}

export interface InsertSceneSetArgs {
  scenarioId: string;
  turnId: string;
  sceneName: string;
  description?: string | null;
}

export class TimelineEventsService {
  constructor(private readonly db: SqliteDatabase) {}

  async insertChapterBreak(
    args: InsertChapterBreakArgs,
    outerTx?: SqliteTransaction
  ): Promise<{ id: string }> {
    const op = async (tx: SqliteTransaction) => {
      await assertTurnBelongsToScenario(tx, args.scenarioId, args.turnId);

      const payload = chapterBreakSpec.schema.parse(args);

      const [event] = await tx
        .insert(timelineEvents)
        .values({
          scenarioId: args.scenarioId,
          turnId: args.turnId,
          kind: "chapter_break",
          orderKey: await this.nextEventOrderKey(tx, {
            scenarioId: args.scenarioId,
            turnId: args.turnId,
          }),
          payloadVersion: 1,
          payload,
        })
        .returning({ id: timelineEvents.id });

      return event;
    };

    return outerTx ? op(outerTx) : this.db.transaction(op);
  }

  async insertParticipantPresence(
    args: InsertPresenceChangeArgs,
    outerTx?: SqliteTransaction
  ): Promise<{ id: string }> {
    const op = async (tx: SqliteTransaction) => {
      await assertTurnBelongsToScenario(tx, args.scenarioId, args.turnId);
      await assertParticipantBelongsToScenario(tx, args.scenarioId, args.participantId);

      const payload = presenceChangeSpec.schema.parse({
        participantId: args.participantId,
        active: args.active,
        status: args.status,
      });

      const [event] = await tx
        .insert(timelineEvents)
        .values({
          scenarioId: args.scenarioId,
          turnId: args.turnId,
          kind: "presence_change",
          orderKey: await this.nextEventOrderKey(tx, {
            scenarioId: args.scenarioId,
            turnId: args.turnId,
          }),
          payloadVersion: 1,
          payload,
        })
        .returning({ id: timelineEvents.id });

      return event;
    };

    return outerTx ? op(outerTx) : this.db.transaction(op);
  }

  /**
   * Insert a scene change event anchored to an existing turn.
   */
  async insertSceneSet(
    args: InsertSceneSetArgs,
    outerTx?: SqliteTransaction
  ): Promise<{ id: string }> {
    const op = async (tx: SqliteTransaction) => {
      await assertTurnBelongsToScenario(tx, args.scenarioId, args.turnId);
      return { id: "" };
    };

    return outerTx ? op(outerTx) : this.db.transaction(op);
  }

  async deleteEvent(eventId: string, outerTx?: SqliteTransaction): Promise<void> {
    const op = async (tx: SqliteTransaction) => {
      const existing = await tx
        .select({ id: timelineEvents.id })
        .from(timelineEvents)
        .where(eq(timelineEvents.id, eventId))
        .limit(1);

      if (!existing.at(0)) {
        throw new ServiceError("NotFound", {
          message: `Timeline event ${eventId} not found.`,
        });
      }

      await tx.delete(timelineEvents).where(eq(timelineEvents.id, eventId));
    };

    return void (outerTx ? await op(outerTx) : await this.db.transaction(op));
  }

  private async nextEventOrderKey(
    tx: SqliteTransaction,
    args: { scenarioId: string; turnId: string | null }
  ): Promise<string> {
    const conditions =
      args.turnId === null
        ? and(eq(timelineEvents.scenarioId, args.scenarioId), sql`turn_id IS NULL`)
        : and(
            eq(timelineEvents.scenarioId, args.scenarioId),
            eq(timelineEvents.turnId, args.turnId)
          );

    const rows = await tx
      .select({ orderKey: timelineEvents.orderKey })
      .from(timelineEvents)
      .where(conditions)
      .orderBy(timelineEvents.orderKey);

    const last = rows.at(-1)?.orderKey ?? "";
    return after(last);
  }
}

async function assertTurnBelongsToScenario(
  tx: SqliteTransaction,
  scenarioId: string,
  turnId: string
): Promise<void> {
  const rows = await tx
    .select({ scenarioId: turns.scenarioId })
    .from(turns)
    .where(eq(turns.id, turnId))
    .limit(1);

  const turn = rows.at(0);
  if (!turn || turn.scenarioId !== scenarioId) {
    throw new ServiceError("NotFound", {
      message: `Turn ${turnId} not found in scenario ${scenarioId}.`,
    });
  }
}

async function assertParticipantBelongsToScenario(
  tx: SqliteTransaction,
  scenarioId: string,
  participantId: string
): Promise<void> {
  const rows = await tx
    .select({ scenarioId: scenarioParticipants.scenarioId })
    .from(scenarioParticipants)
    .where(eq(scenarioParticipants.id, participantId))
    .limit(1);

  const participant = rows.at(0);
  if (!participant || participant.scenarioId !== scenarioId) {
    throw new ServiceError("NotFound", {
      message: `Participant ${participantId} not found in scenario ${scenarioId}.`,
    });
  }
}
