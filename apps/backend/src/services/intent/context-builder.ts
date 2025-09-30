import {
  type Character,
  type NewIntent,
  type SqliteTxLike,
  characters as tCharacters,
  scenarioParticipants as tScenarioParticipants,
  scenarios as tScenarios,
} from "@storyforge/db";
import type { CharacterCtxDTO, TurnGenCtx } from "@storyforge/gentasks";
import { assertDefined } from "@storyforge/utils";
import { and, asc, eq, sql } from "drizzle-orm";
import { getFullTimelineTurnCtx } from "../timeline/timeline.queries.js";
import { TimelineStateService } from "../timeline-events/timeline-state.service.js";
import { eventDTOsByTurn } from "../timeline-events/utils/event-dtos.js";
import { getTurnIntentPrompt } from "./utils/intent-prompts.js";

interface BuildContextArgs {
  actorParticipantId: string;
  intent?: { kind: NewIntent["kind"]; constraint?: string };
  leafTurnId?: string | null;
}

export class IntentContextBuilder {
  constructor(
    private db: SqliteTxLike,
    private scenarioId: string
  ) {}

  async buildContext(args: BuildContextArgs): Promise<TurnGenCtx> {
    const { actorParticipantId, intent, leafTurnId = null } = args;
    const stateService = new TimelineStateService(this.db);

    const derivationPromise = stateService.deriveState(this.scenarioId, leafTurnId);
    const charaDataPromise = this.loadParticipantCharaData(actorParticipantId);
    const scenarioPromise = this.loadScenarioData();
    const turnsPromise = getFullTimelineTurnCtx(this.db, {
      leafTurnId,
      scenarioId: this.scenarioId,
    });

    const [charaData, derivation, scenario, turns] = await Promise.all([
      charaDataPromise,
      derivationPromise,
      scenarioPromise,
      turnsPromise,
    ]);

    const { characters, userProxyName, currentActorName } = charaData;

    // Enrich turn DTO with events
    const eventsByTurn = eventDTOsByTurn(derivation.events);
    const enrichedTurns = turns.map((t) => ({
      ...t,
      events: eventsByTurn[t.turnId] ?? [],
    }));
    const nextTurnNumber = (turns.at(-1)?.turnNo ?? 0) + 1;

    return {
      turns: enrichedTurns,
      characters,
      // TODO: this is definitely not a good way to do this
      // templates may need raw kind for switch case behavior, but also need
      // model-friendly kind and a formatted prompt to insert in the text
      ...(intent
        ? {
            currentIntent: {
              kind: intent.kind,
              constraint: intent.constraint,
              prompt: getTurnIntentPrompt({
                kind: intent.kind,
                targetName: currentActorName,
                text: intent.constraint ?? null,
              })?.prompt,
            },
          }
        : {}),
      nextTurnNumber,
      stepInputs: {},
      globals: {
        char: currentActorName,
        user: userProxyName,
        scenario: scenario.description,
        isNarratorTurn: charaData.actorIsNarrator,
      },
    };
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
    actorIsNarrator: boolean;
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
      .orderBy(cardTypeRank, asc(tScenarioParticipants.isUserProxy), asc(tCharacters.name));

    // Try to find a player proxy
    const proxyCandidates = data.slice().sort((a, b) => {
      // explicit user proxy first
      if (a.isUserProxy !== b.isUserProxy) return a.isUserProxy ? -1 : 1;
      // personas before others
      const aPersona = a.charaType === "persona";
      const bPersona = b.charaType === "persona";
      if (aPersona !== bPersona) return aPersona ? -1 : 1;
      // break ties by name
      return a.name.localeCompare(b.name);
    });
    const userProxyName = proxyCandidates.at(0)?.name;

    // Narrator doesn't exist as a character, so they won't be in the list
    const actorIsNarrator = !proxyCandidates.some(
      (chara) => chara.participantId === actorParticipantId
    );

    // TODO: Make narrator name configurable
    const currentActorName = actorIsNarrator
      ? "Narrator"
      : data.find((chara) => chara.participantId === actorParticipantId)?.name;

    // DB constraints and invariants should ensure neither of these are null
    assertDefined(currentActorName, "Actor character not found");
    assertDefined(userProxyName, "No fallback player proxy character found");

    // TODO: HACK - we replace `{{char}}` macros in character data here.
    // normally the template engine would handle this, but it uses a single
    // replacement (`currentActorName`) for the entire prompt. this is
    // problematic because within a character's description, the `{{char}}`
    // macro actually refers to the character the description is for, not the
    // current actor.
    const characters = data.map((chara) => ({
      id: chara.id,
      name: chara.name,
      description: chara.description.replaceAll("{{char}}", currentActorName),
    }));

    return { characters, userProxyName, currentActorName, actorIsNarrator };
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
