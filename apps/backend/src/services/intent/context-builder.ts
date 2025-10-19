import {
  type Character,
  type NewIntent,
  type SqliteTxLike,
  characters as tCharacters,
  scenarioParticipants as tScenarioParticipants,
  scenarios as tScenarios,
} from "@storyforge/db";
import type { CharacterCtxDTO, TurnGenCtx } from "@storyforge/gentasks";
import { scanLorebooks } from "@storyforge/lorebooks";
import { assertDefined, stripNulls } from "@storyforge/utils";
import { and, asc, eq, sql } from "drizzle-orm";
import { loadScenarioLorebookAssignments } from "../lorebook/lorebook.queries.js";
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
    const lorebooksPromise = loadScenarioLorebookAssignments(this.db, this.scenarioId);

    const [charaData, derivation, scenario, turns, lorebooks] = await Promise.all([
      charaDataPromise,
      derivationPromise,
      scenarioPromise,
      turnsPromise,
      lorebooksPromise,
    ]);

    const { characters, userProxyName, actor, actorIsNarrator } = charaData;
    const actorName = actorIsNarrator ? "Narrator" : actor.name;

    // Enrich turn DTO with events
    const eventsByTurn = eventDTOsByTurn(derivation.events);
    const enrichedTurns = turns.map((t) => ({
      ...t,
      events: eventsByTurn[t.turnId] ?? [],
    }));
    const nextTurnNumber = (turns.at(-1)?.turnNo ?? 0) + 1;
    // TODO: this is definitely not a good way to do this
    // templates may need raw kind for switch case behavior, but also need
    // model-friendly kind and a formatted prompt to insert in the text
    const intentPrompt = intent
      ? getTurnIntentPrompt({
          kind: intent.kind,
          targetName: actorName,
          text: intent.constraint ?? null,
        })?.prompt
      : undefined;

    const loreEntries = scanLorebooks({
      turns: enrichedTurns,
      lorebooks,
      // user input should be able to trigger lorebook entries
      options: { extraSegments: [intentPrompt ?? ""] },
    });

    return {
      turns: enrichedTurns,
      characters,
      actor,
      ...(intent
        ? {
            currentIntent: {
              kind: intent.kind,
              constraint: intent.constraint,
              prompt: intentPrompt,
            },
          }
        : {}),
      nextTurnNumber,
      globals: {
        char: actorName,
        user: userProxyName,
        scenario: scenario.description,
        isNarratorTurn: actorIsNarrator,
      },
      loreEntriesByPosition: loreEntries,
    };
  }

  /**
   * Loads character information from the database for active participants in
   * the current scenario, ordered by card type.
   * @private
   */
  private async loadParticipantCharaData(actorParticipantId: string): Promise<{
    characters: CharacterCtxDTO[];
    actor: CharacterCtxDTO;
    userProxyName: string;
    actorIsNarrator: boolean;
  }> {
    // TODO: Possibly make sorting configurable via recipe
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

    const data = await this.db
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
      const aPersona = a.type === "persona";
      const bPersona = b.type === "persona";
      if (aPersona !== bPersona) return aPersona ? -1 : 1;
      // break ties by name
      return a.name.localeCompare(b.name);
    });
    const userProxyName = proxyCandidates.at(0)?.name;

    // TODO: Handle characters with cardType "narrator" specially, which should replace
    // the fake 'Narrator' character.

    // Generic narrator doesn't exist as a character, so they won't be in the list
    const actorIsNarrator = !proxyCandidates.some(
      (chara) => chara.participantId === actorParticipantId
    );

    const actor = actorIsNarrator
      ? { id: "narrator", name: "Narrator", description: "", type: "narrator" as const }
      : data.find((chara) => chara.participantId === actorParticipantId);
    // DB constraints and invariants should ensure neither of these are null
    assertDefined(actor, "Actor participant not found in scenario");
    assertDefined(userProxyName, "No fallback player proxy character found");

    // TODO: HACK - we replace `{{char}}` macros in character data here. This is
    // because in the context of the prompt, {{char}} resolves to the currently
    // acting character. But in the context of character descriptions, the same
    // macro resolves to the character being described. This is how SillyTavern
    // works so all cards in its ecosystem make this assumption.
    const characters = data.map((chara) =>
      stripNulls({
        id: chara.id,
        name: chara.name,
        description: chara.description.replaceAll("{{char}}", chara.name),
        type: chara.type,
        styleInstructions: chara.styleInstructions,
      })
    );

    return { characters, actor: stripNulls(actor), userProxyName, actorIsNarrator };
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
