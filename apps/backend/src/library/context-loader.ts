import type { Character, StoryforgeSqliteDatabase } from "@storyforge/db";
import { schema } from "@storyforge/db";
import { sql } from "drizzle-orm";
import {
  getTurnTimelineWindow,
  type TurnTimelineRow,
} from "@/library/turn/turn.queries";

export type ContextSpec = {
  scenarioId: string;
  leafTurnId: string; // usually scenario.current_turn_id, unless paging up
  timelineWindow: number; // how many nodes from the leaf upward
};

export type LoadedParticipant = {
  id: string;
  role: string | null;
  orderIndex: number;
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
  timeline: TurnTimelineRow[];
  // TODO: include turn contents when that table exists (messages, diffs, tool calls, etc.)
  // messagesByTurnId: Record<string, TurnMessage[]>;
  // templates, lorebooks, etc. can be slotted here too
  systemTemplate?: string | null; // optional: fetched from settings or templates table
};

export async function loadContext(
  db: StoryforgeSqliteDatabase,
  spec: ContextSpec
): Promise<LoadedContext> {
  const { scenarioId, leafTurnId, timelineWindow } = spec;

  // Scenario + active participants with character summaries.
  const [scenario] = await db
    .select({
      id: schema.scenarios.id,
      name: schema.scenarios.name,
      description: schema.scenarios.description,
      settings: schema.scenarios.settings,
    })
    .from(schema.scenarios)
    .where(sql`${schema.scenarios.id} = ${scenarioId}`)
    .limit(1);

  if (!scenario) throw new Error("Scenario not found");

  const participants = await db.query.scenarioParticipants.findMany({
    columns: { id: true, role: true, orderIndex: true },
    where: { scenarioId },
    with: {
      character: {
        columns: { id: true, name: true, description: true, cardType: true },
      },
    },
    orderBy: (p) => [p.orderIndex],
  });

  const timeline = await getTurnTimelineWindow(db, {
    leafTurnId,
    windowSize: timelineWindow,
  });

  // TODO: Load systemTemplate / next-task instruction once that source exists.
  // const systemTemplate = await getSystemTemplateForScenario(db, scenarioId);

  // Adapt to LoadedParticipant shape
  const loadedParticipants = participants.map((p) => {
    if (!p.character) throw new Error(`Participant ${p.id} missing character`);
    return {
      id: p.id,
      role: p.role,
      orderIndex: p.orderIndex,
      character: p.character,
    } satisfies LoadedParticipant;
  });

  return {
    scenario,
    participants: loadedParticipants,
    timeline,
    systemTemplate: null,
  };
}
