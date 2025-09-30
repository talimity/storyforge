import { type SqliteDatabase, type SqliteTransaction, schema } from "@storyforge/db";
import { chapterBreakSpec, presenceChangeSpec } from "@storyforge/timeline-events";
import { after } from "@storyforge/utils";
import { and, eq, sql } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";

const { timelineEvents, turns, scenarioParticipants, scenarios } = schema;

interface InsertChapterBreakArgs {
  scenarioId: string;
  turnId: string;
  nextChapterTitle: string | null;
}

interface RenameChapterBreakArgs {
  scenarioId: string;
  eventId: string;
  nextChapterTitle: string | null;
}

interface InsertPresenceChangeArgs {
  scenarioId: string;
  turnId: string;
  participantId: string;
  active: boolean;
  status?: string | null;
}

interface InsertSceneSetArgs {
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
      if (args.turnId) {
        await assertTurnBelongsToScenario(tx, args.scenarioId, args.turnId);
      }

      await this.ensureInitialChapterEvent(tx, args.scenarioId);

      if (await this.hasChapterBreakOnTurn(tx, args.scenarioId, args.turnId)) {
        throw new ServiceError("InvalidInput", {
          message: `A chapter break already exists on turn ${args.turnId ?? "<initial>"}.`,
        });
      }

      const payload = chapterBreakSpec.schema.parse({
        nextChapterTitle: args.nextChapterTitle,
      });

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
          payloadVersion: chapterBreakSpec.latest,
          payload,
        })
        .returning({ id: timelineEvents.id });

      return event;
    };

    return outerTx ? op(outerTx) : this.db.transaction(op);
  }

  async renameChapterBreak(
    args: RenameChapterBreakArgs,
    outerTx?: SqliteTransaction
  ): Promise<{ id: string; payloadVersion: number }> {
    const op = async (tx: SqliteTransaction) => {
      const existing = await tx
        .select({
          id: timelineEvents.id,
          scenarioId: timelineEvents.scenarioId,
          kind: timelineEvents.kind,
        })
        .from(timelineEvents)
        .where(eq(timelineEvents.id, args.eventId))
        .limit(1);

      const event = existing.at(0);
      if (!event || event.scenarioId !== args.scenarioId) {
        throw new ServiceError("NotFound", {
          message: `Timeline event ${args.eventId} not found in scenario ${args.scenarioId}.`,
        });
      }

      if (event.kind !== "chapter_break") {
        throw new ServiceError("InvalidInput", {
          message: `Timeline event ${args.eventId} is not a chapter break event.`,
        });
      }

      const payload = chapterBreakSpec.schema.parse({
        nextChapterTitle: args.nextChapterTitle,
      });

      const [updated] = await tx
        .update(timelineEvents)
        .set({
          payloadVersion: chapterBreakSpec.latest,
          payload,
        })
        .where(eq(timelineEvents.id, args.eventId))
        .returning({
          id: timelineEvents.id,
          payloadVersion: timelineEvents.payloadVersion,
        });

      return updated;
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
          payloadVersion: presenceChangeSpec.latest,
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

  private async ensureInitialChapterEvent(tx: SqliteTransaction, scenarioId: string) {
    await assertScenarioExists(tx, scenarioId);
    const existing = await tx
      .select({ id: timelineEvents.id })
      .from(timelineEvents)
      .where(
        and(
          eq(timelineEvents.scenarioId, scenarioId),
          eq(timelineEvents.kind, "chapter_break"),
          sql`turn_id IS NULL`
        )
      )
      .limit(1);

    if (existing.at(0)) return;

    const payload = chapterBreakSpec.schema.parse({
      nextChapterTitle: null,
    });

    await tx.insert(timelineEvents).values({
      scenarioId,
      turnId: null,
      kind: "chapter_break",
      orderKey: await this.nextEventOrderKey(tx, { scenarioId, turnId: null }),
      payloadVersion: chapterBreakSpec.latest,
      payload,
    });
  }

  private async hasChapterBreakOnTurn(
    tx: SqliteTransaction,
    scenarioId: string,
    turnId: string | null
  ) {
    const existing = await tx
      .select({ id: timelineEvents.id })
      .from(timelineEvents)
      .where(
        and(
          eq(timelineEvents.scenarioId, scenarioId),
          eq(timelineEvents.kind, "chapter_break"),
          turnId === null ? sql`turn_id IS NULL` : eq(timelineEvents.turnId, turnId)
        )
      )
      .limit(1);

    return Boolean(existing.at(0));
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

async function assertScenarioExists(tx: SqliteTransaction, scenarioId: string) {
  const rows = await tx
    .select({ id: scenarios.id, name: scenarios.name })
    .from(scenarios)
    .where(eq(scenarios.id, scenarioId))
    .limit(1);

  const scenario = rows.at(0);
  if (!scenario) {
    throw new ServiceError("NotFound", {
      message: `Scenario ${scenarioId} not found`,
    });
  }

  return scenario;
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
