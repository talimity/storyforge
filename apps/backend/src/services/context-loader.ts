import type { Character, SqliteDatabase } from "@storyforge/db";
import { schema } from "@storyforge/db";
import { sql } from "drizzle-orm";
import {
  getTimelineWindow,
  getTurnContentLayers,
  type TimelineRow,
} from "@/services/turn/turn.queries";

export type ContextSpec = {
  scenarioId: string;
  timelineWindow: number;
};

export type LoadedParticipant = {
  id: string;
  role: string | null;
  orderIndex: number;
  isUserProxy: boolean;
  character: Pick<Character, "id" | "name" | "description" | "cardType">;
};

export type LoadedContext = {
  scenario: {
    id: string;
    name: string;
    description: string | null;
    settings: unknown | null;
  };
  participants: LoadedParticipant[];
  timeline: TimelineRow[];
  contentByTurnId: Record<
    string, // turnId
    Record<string, string> // layer's key => layer's content
  >;
  systemTemplate?: string | null; // optional: fetched from settings or templates table
};

export async function loadContext(
  db: SqliteDatabase,
  spec: ContextSpec
): Promise<LoadedContext> {
  const { scenarioId, timelineWindow } = spec;

  // Scenario + active participants with character summaries.
  const [scenario] = await db
    .select({
      id: schema.scenarios.id,
      name: schema.scenarios.name,
      description: schema.scenarios.description,
      settings: schema.scenarios.settings,
      anchorTurnId: schema.scenarios.anchorTurnId,
    })
    .from(schema.scenarios)
    .where(sql`${schema.scenarios.id} = ${scenarioId}`)
    .limit(1);

  if (!scenario) throw new Error("Scenario not found");

  const participants = await db.query.scenarioParticipants.findMany({
    columns: { id: true, role: true, orderIndex: true, isUserProxy: true },
    where: { scenarioId },
    with: {
      character: {
        columns: { id: true, name: true, description: true, cardType: true },
      },
    },
    orderBy: (p) => [p.orderIndex],
  });

  const timeline = await getTimelineWindow(db, {
    scenarioId,
    leafTurnId: scenario.anchorTurnId,
    windowSize: timelineWindow,
  });

  // Load turn content for all turns in the timeline
  const turnIds = timeline.map((node) => node.id);
  const turnsWithContent = await getTurnContentLayers(db, turnIds);

  // Group content by turn ID and key for easy access
  const contentByTurnId: LoadedContext["contentByTurnId"] = {};
  for (const turn of turnsWithContent) {
    contentByTurnId[turn.turnId] = turn.contentLayers;
  }

  // TODO: Load systemTemplate / next-task instruction once that source exists.
  // const systemTemplate = await getSystemTemplateForScenario(db, scenarioId);

  // Adapt to LoadedParticipant shape
  const loadedParticipants = participants.map((p) => {
    if (!p.character) throw new Error(`Participant ${p.id} missing character`);
    return {
      id: p.id,
      role: p.role,
      orderIndex: p.orderIndex,
      isUserProxy: p.isUserProxy,
      character: p.character,
    } satisfies LoadedParticipant;
  });

  return {
    scenario,
    participants: loadedParticipants,
    timeline,
    contentByTurnId,
    systemTemplate: null,
  };
}
