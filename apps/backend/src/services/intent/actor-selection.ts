import { type SqliteDatabase, scenarioParticipants } from "@storyforge/db";
import { and, asc, eq, inArray } from "drizzle-orm";

export async function chooseNextActorRoundRobin(
  db: SqliteDatabase,
  scenarioId: string,
  opts: {
    /**
     * The participant ID of the author of the turn just completed. If
     * not provided, the first active participant by orderIndex will be
     * chosen.
     */
    afterTurnAuthorParticipantId?: string;
    /**
     * Whether the scenario narrator should be eligible for selection. By
     * default, only characters can be selected.
     */
    includeNarrator?: boolean;
  }
): Promise<string> {
  const { afterTurnAuthorParticipantId, includeNarrator = false } = opts;

  const participantTypes = includeNarrator
    ? (["narrator", "character"] as const)
    : (["character"] as const);

  const participants = await db
    .select({ id: scenarioParticipants.id, idx: scenarioParticipants.orderIndex })
    .from(scenarioParticipants)
    .where(
      and(
        eq(scenarioParticipants.scenarioId, scenarioId),
        eq(scenarioParticipants.status, "active"),
        inArray(scenarioParticipants.type, participantTypes)
      )
    )
    .orderBy(asc(scenarioParticipants.orderIndex));

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
