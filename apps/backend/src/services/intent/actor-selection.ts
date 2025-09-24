import { type SqliteDatabase, scenarioParticipants } from "@storyforge/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { getTimelineWindow } from "../timeline/timeline.queries.js";

interface ChooseNextActorOpts {
  includeNarrator?: boolean;
  leafTurnId?: string | null;
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
    .select({ id: scenarioParticipants.id, orderIndex: scenarioParticipants.orderIndex })
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
    throw new ServiceError("NotFound", {
      message: `No active participants found for scenario ${scenarioId}`,
    });
  }

  if (participants.length === 1) {
    return participants[0].id;
  }

  const orderedIds: string[] = [];
  const indexById = new Map<string, number>();
  for (let i = 0; i < participants.length; i += 1) {
    const participant = participants[i];
    orderedIds.push(participant.id);
    indexById.set(participant.id, i);
  }

  const eligibleIds = new Set(orderedIds);
  const effectiveWindowSize = windowSize ?? Math.max(participants.length * 4, 16);

  const timelineRows = await getTimelineWindow(db, {
    scenarioId,
    leafTurnId: leafTurnId ?? null,
    cursorTurnId: leafTurnId ?? null,
    windowSize: effectiveWindowSize,
    layer: "presentation",
  });

  const history: string[] = [];
  for (const row of timelineRows) {
    if (eligibleIds.has(row.author_participant_id)) {
      history.push(row.author_participant_id);
    }
  }

  history.reverse();

  const lastEligible = history[0];
  if (!lastEligible || !indexById.has(lastEligible)) {
    return orderedIds[0];
  }

  const seenInCycle = new Set<string>();
  for (const participantId of history) {
    if (!seenInCycle.has(participantId)) {
      seenInCycle.add(participantId);
    }
    if (seenInCycle.size === orderedIds.length) {
      break;
    }
  }

  if (seenInCycle.size < orderedIds.length) {
    const missingNext = findNextMatching(orderedIds, indexById, lastEligible, (id) => {
      return !seenInCycle.has(id);
    });
    if (missingNext) {
      return missingNext;
    }
  }

  const fallback = findNextMatching(orderedIds, indexById, lastEligible, () => true);
  return fallback ?? orderedIds[0];
}

function findNextMatching(
  orderedIds: string[],
  indexById: Map<string, number>,
  afterId: string,
  predicate: (id: string) => boolean
): string | undefined {
  const total = orderedIds.length;
  const startIndex = indexById.get(afterId) ?? -1;
  for (let offset = 1; offset <= total; offset += 1) {
    const candidateIndex = (startIndex + offset + total) % total;
    const candidate = orderedIds[candidateIndex];
    if (predicate(candidate)) {
      return candidate;
    }
  }
  return undefined;
}
