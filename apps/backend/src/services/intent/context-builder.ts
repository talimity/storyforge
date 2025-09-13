import {
  type Character,
  type NewIntent,
  type SqliteTxLike,
  characters as tCharacters,
  scenarioParticipants as tScenarioParticipants,
  scenarios as tScenarios,
} from "@storyforge/db";
import type { CharacterCtxDTO, TurnGenCtx } from "@storyforge/gentasks";
import { assertDefined, assertNever } from "@storyforge/utils";
import { and, asc, eq, sql } from "drizzle-orm";
import { getFullTimelineTurnCtx } from "../timeline/timeline.queries.js";

interface BuildContextArgs {
  actorParticipantId: string;
  intent: { kind: NewIntent["kind"]; constraint?: string };
  leafTurnId?: string | null;
}

export class IntentContextBuilder {
  constructor(
    private db: SqliteTxLike,
    private scenarioId: string
  ) {}

  async buildContext(args: BuildContextArgs): Promise<TurnGenCtx> {
    const { actorParticipantId, intent, leafTurnId } = args;

    const [charaData, turns, scenario] = await Promise.all([
      this.loadParticipantCharaData(actorParticipantId),
      getFullTimelineTurnCtx(this.db, {
        leafTurnId: leafTurnId ?? null,
        scenarioId: this.scenarioId,
      }),
      this.loadScenarioData(),
    ]);
    const { characters, userProxyName, currentActorName } = charaData;

    return {
      turns,
      characters,
      currentIntent: {
        kind: intent.kind,
        description: this.mapIntentDescription(intent.kind),
        constraint: intent.constraint,
      },
      stepInputs: {},
      globals: {
        char: currentActorName,
        user: userProxyName,
        scenario: scenario.description,
      },
    };
  }

  // TODO: Don't use intent parameters directly in the turngen context., leaks
  // too much implementation detail into the model prompt
  private mapIntentDescription(kind: NewIntent["kind"]): string {
    switch (kind) {
      case "manual_control":
        return "Manual Control";
      case "guided_control":
        return "Guided Control";
      case "narrative_constraint":
        return "Narrative Constraint";
      case "continue_story":
        return "Continue Story";
      default:
        assertNever(kind);
    }
  }

  /**
   * Loads character information from the database for active participants in
   * the current scenario, ordered by card type.
   * @private
   */
  private async loadParticipantCharaData(actorParticipantId: string): Promise<{
    characters: CharacterCtxDTO[];
    userProxyName: string;
    currentActorName: string;
  }> {
    // TODO: Possibly make sorting configurable via recipe
    const charaTypeSort: [Character["cardType"], number][] = [
      ["character", 0],
      ["scenario", 1],
      ["group", 2],
      ["persona", 3],
    ];
    const whenClauses = sql.join(
      charaTypeSort.map(([type, idx]) => sql`WHEN ${type} THEN ${idx}`),
      sql.raw(" ")
    );
    const cardTypeRank = sql`CASE ${tCharacters.cardType} ${whenClauses} ELSE 999 END`;

    const data = await this.db
      .select({
        id: tCharacters.id,
        name: tCharacters.name,
        description: tCharacters.description,
        participantId: tScenarioParticipants.id,
        isUserProxy: tScenarioParticipants.isUserProxy,
        charaType: tCharacters.cardType,
      })
      .from(tCharacters)
      .innerJoin(
        tScenarioParticipants,
        and(
          eq(tScenarioParticipants.scenarioId, this.scenarioId),
          eq(tScenarioParticipants.characterId, tCharacters.id),
          eq(tScenarioParticipants.status, "active")
        )
      )
      .orderBy(cardTypeRank, asc(tCharacters.name));

    // Try to find a player proxy
    const proxyCandidates = data.slice().sort((a, b) => {
      // explicit user proxy first
      if (a.isUserProxy !== b.isUserProxy) return a.isUserProxy ? -1 : 1;
      // current actor is always last
      const aIsActor = a.participantId === actorParticipantId;
      const bIsActor = b.participantId === actorParticipantId;
      if (aIsActor !== bIsActor) return aIsActor ? 1 : -1;
      // personas before others
      const aPersona = a.charaType === "persona";
      const bPersona = b.charaType === "persona";
      if (aPersona !== bPersona) return aPersona ? -1 : 1;
      // break ties by name
      return a.name.localeCompare(b.name);
    });
    const userProxyName = proxyCandidates.at(0)?.name;
    const currentActorName = proxyCandidates.at(-1)?.name;
    // DB constraints and invariants should ensure neither of these are null
    assertDefined(currentActorName, "Actor character not found");
    assertDefined(userProxyName, "No fallback player proxy character found");

    const characters = data.map((chara) => ({
      id: chara.id,
      name: chara.name,
      description: chara.description,
    }));

    return { characters, userProxyName, currentActorName };
  }

  private async loadScenarioData() {
    const [scenario] = await this.db
      .select({ name: tScenarios.name, description: tScenarios.description })
      .from(tScenarios)
      .where(eq(tScenarios.id, this.scenarioId))
      .limit(1);
    return scenario;
  }
}
