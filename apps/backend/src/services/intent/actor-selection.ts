import { type SqliteDatabase, scenarioParticipants } from "@storyforge/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { getAuthorHistoryWindow } from "../timeline/timeline.queries.js";
import { TimelineStateService } from "../timeline-events/timeline-state.service.js";

interface ChooseNextActorOpts {
  includeNarrator?: boolean;
  leafTurnId?: string;
  windowSize?: number;
}

/**
 * Choose the next participant to act by performing a timeline-aware round robin
 * over the eligible speakers.
 *
 * The selection inspects recent turns along the timeline path ending at
 * `leafTurnId` (or the scenario anchor when omitted). Narrator turns are only
 * counted when `includeNarrator` is true. The most recent cycle is examined to
 * find participants who have not yet acted; if every eligible participant has
 * spoken, the cycle wraps back to the participant immediately after the latest
 * eligible speaker.
 *
 * @param db Database handle scoped to the scenario.
 * @param scenarioId Scenario whose timeline is being advanced.
 * @param opts Selection options controlling eligibility and history window.
 */
export async function chooseNextActorFair(
  db: SqliteDatabase,
  scenarioId: string,
  opts: ChooseNextActorOpts
): Promise<string> {
  const { includeNarrator = false, leafTurnId, windowSize } = opts;

  const participantTypes = includeNarrator
    ? (["character", "narrator"] as const)
    : (["character"] as const);

  const participants = await db
    .select({
      id: scenarioParticipants.id,
      orderIndex: scenarioParticipants.orderIndex,
      type: scenarioParticipants.type,
    })
    .from(scenarioParticipants)
    .where(
      and(
        eq(scenarioParticipants.scenarioId, scenarioId),
        eq(scenarioParticipants.status, "active"),
        inArray(scenarioParticipants.type, participantTypes)
      )
    )
    .orderBy(asc(scenarioParticipants.orderIndex));

  const narrator = await db.query.scenarioParticipants.findFirst({
    where: { scenarioId, type: "narrator" },
    columns: { id: true },
  });

  if (participants.length === 0) {
    if (narrator?.id) return narrator.id;
    throw new ServiceError("NotFound", {
      message: `No active participants found for scenario ${scenarioId}`,
    });
  }

  // Use state service to derive the current timeline state so we know which
  // actors are present in the scene.
  const stateService = new TimelineStateService(db);
  const derivation = await stateService.deriveState(scenarioId, leafTurnId);
  const { presence } = derivation.final;

  const eligibleParticipants = participants.filter((participant) => {
    const actorPresence = presence.participantPresence[participant.id];
    // no presence value just means active
    if (!actorPresence) return true;
    return actorPresence.active;
  });

  if (eligibleParticipants.length === 0) {
    if (narrator?.id) return narrator.id;
    throw new ServiceError("NotFound", {
      message: `No eligible participants available for scenario ${scenarioId}`,
    });
  }

  if (eligibleParticipants.length === 1) {
    return eligibleParticipants[0].id;
  }

  const orderedIds: string[] = [];
  const indexById = new Map<string, number>();
  for (let i = 0; i < eligibleParticipants.length; i += 1) {
    const participant = eligibleParticipants[i];
    orderedIds.push(participant.id);
    indexById.set(participant.id, i);
  }

  const eligibleIds = new Set(orderedIds);

  const authorHistory = await getAuthorHistoryWindow(db, {
    scenarioId,
    leafTurnId,
    windowSize: windowSize ?? Math.max(eligibleParticipants.length * 4, 16),
  });

  const history = authorHistory.filter((id) => eligibleIds.has(id));

  const seenInCycle = new Set<string>();
  let lastEligible: string | undefined;

  for (const participantId of history) {
    if (!eligibleIds.has(participantId)) continue;
    if (!lastEligible) {
      lastEligible = participantId;
    }
    if (!seenInCycle.has(participantId)) {
      seenInCycle.add(participantId);
      if (seenInCycle.size === orderedIds.length) break;
    }
  }

  for (const participantId of orderedIds) {
    if (!seenInCycle.has(participantId)) {
      return participantId;
    }
  }

  if (!lastEligible) {
    return orderedIds[0];
  }

  const startIndex = indexById.get(lastEligible) ?? 0;
  return orderedIds[(startIndex + 1) % orderedIds.length];
}
