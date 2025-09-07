import { type SqliteDatabase, schema } from "@storyforge/db";
import { and, asc, eq } from "drizzle-orm";

export async function chooseNextActorRoundRobin(
  db: SqliteDatabase,
  scenarioId: string,
  afterTurnAuthorParticipantId?: string
): Promise<string> {
  const participants = await db
    .select({
      id: schema.scenarioParticipants.id,
      idx: schema.scenarioParticipants.orderIndex,
    })
    .from(schema.scenarioParticipants)
    .where(
      and(
        eq(schema.scenarioParticipants.scenarioId, scenarioId),
        eq(schema.scenarioParticipants.status, "active")
      )
    )
    .orderBy(asc(schema.scenarioParticipants.orderIndex));

  if (participants.length === 0) {
    throw new Error("No active participants in scenario.");
  }

  if (!afterTurnAuthorParticipantId) {
    return participants[0].id;
  }

  // Find the participant after the author
  const pos = participants.findIndex((p) => p.id === afterTurnAuthorParticipantId);
  if (pos === -1) return participants[0].id;
  return participants[(pos + 1) % participants.length].id;
}
