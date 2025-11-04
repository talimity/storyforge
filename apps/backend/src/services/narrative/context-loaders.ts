import {
  type Character,
  type SqliteTxLike,
  characters as tCharacters,
  scenarioParticipants as tScenarioParticipants,
  scenarios as tScenarios,
} from "@storyforge/db";
import type { CharacterContext } from "@storyforge/gentasks";
import { assertDefined, stripNulls } from "@storyforge/utils";
import { and, asc, eq, sql } from "drizzle-orm";

export type ScenarioCharacterContext = {
  characters: CharacterContext[];
  userProxyName: string;
  byParticipantId: Map<string, CharacterContext>;
};

/**
 * Loads character context for an entire scenario, returning ordered character data
 * along with participant mappings and the inferred user proxy name.
 */
export async function loadScenarioCharacterContext(
  db: SqliteTxLike,
  scenarioId: string
): Promise<ScenarioCharacterContext> {
  const charaTypeSort: [Character["cardType"], number][] = [
    ["character", 0],
    ["narrator", 1],
    ["group", 2],
    ["persona", 3],
  ];
  const whenClauses = sql.join(
    charaTypeSort.map(([type, idx]) => sql`WHEN ${type} THEN ${idx}`),
    sql.raw(" ")
  );
  const cardTypeRank = sql`CASE ${tCharacters.cardType} ${whenClauses} ELSE 999 END`;

  const rows = await db
    .select({
      id: tCharacters.id,
      name: tCharacters.name,
      description: tCharacters.description,
      participantId: tScenarioParticipants.id,
      isUserProxy: tScenarioParticipants.isUserProxy,
      type: tCharacters.cardType,
      styleInstructions: tCharacters.styleInstructions,
    })
    .from(tCharacters)
    .innerJoin(
      tScenarioParticipants,
      and(
        eq(tScenarioParticipants.scenarioId, scenarioId),
        eq(tScenarioParticipants.characterId, tCharacters.id),
        eq(tScenarioParticipants.status, "active")
      )
    )
    .orderBy(cardTypeRank, asc(tScenarioParticipants.isUserProxy), asc(tCharacters.name));

  const proxyCandidates = rows.slice().sort((a, b) => {
    if (a.isUserProxy !== b.isUserProxy) return a.isUserProxy ? -1 : 1;
    const aPersona = a.type === "persona";
    const bPersona = b.type === "persona";
    if (aPersona !== bPersona) return aPersona ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const userProxyName = proxyCandidates.at(0)?.name;
  assertDefined(userProxyName, "No fallback player proxy character found");

  const byParticipantId = new Map<string, CharacterContext>();
  const characters = rows.map((row) => {
    const character = stripNulls({
      id: row.id,
      name: row.name,
      description: row.description.replaceAll("{{char}}", row.name),
      type: row.type,
      styleInstructions: row.styleInstructions ?? undefined,
    });
    byParticipantId.set(row.participantId, character);
    return character;
  });

  return { characters, userProxyName, byParticipantId };
}

export type ScenarioMetadata = {
  name: string;
  description: string;
};

export async function loadScenarioMetadata(
  db: SqliteTxLike,
  scenarioId: string
): Promise<ScenarioMetadata> {
  const [scenario] = await db
    .select({ name: tScenarios.name, description: tScenarios.description })
    .from(tScenarios)
    .where(eq(tScenarios.id, scenarioId))
    .limit(1);
  assertDefined(scenario, `Scenario ${scenarioId} not found`);
  return scenario;
}
