import type { NewIntent, SqliteDatabase, SqliteTxLike } from "@storyforge/db";
import type { TurnGenCtx } from "@storyforge/gentasks";
import { assertDefined } from "@storyforge/utils";
import { ChapterSummariesService } from "../chapter-summaries/chapter-summaries.service.js";
import { loadScenarioLorebookAssignments } from "../lorebook/lorebook.queries.js";
import {
  loadScenarioCharacterContext,
  loadScenarioMetadata,
} from "../narrative/context-loaders.js";
import { attachEventsToTurns } from "../narrative/turn-utils.js";
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
    const charaDataPromise = loadScenarioCharacterContext(this.db, this.scenarioId);
    const scenarioPromise = loadScenarioMetadata(this.db, this.scenarioId);
    const turnsPromise = getFullTimelineTurnCtx(this.db, {
      leafTurnId,
      scenarioId: this.scenarioId,
    });
    const lorebooksPromise = loadScenarioLorebookAssignments(this.db, this.scenarioId);
    const summaryService = new ChapterSummariesService(this.db as SqliteDatabase);
    const chaptersPromise = summaryService.getSummariesForPath({
      scenarioId: this.scenarioId,
      leafTurnId,
    });

    const [charaData, derivation, scenario, turns, lorebooks, chapterSummaries] = await Promise.all(
      [
        charaDataPromise,
        derivationPromise,
        scenarioPromise,
        turnsPromise,
        lorebooksPromise,
        chaptersPromise,
      ]
    );

    const { characters, userProxyName, byParticipantId } = charaData;
    const actorFromMap = byParticipantId.get(actorParticipantId);
    const actorIsNarrator = !actorFromMap;
    const actor = actorIsNarrator
      ? ({ id: "narrator", name: "Narrator", description: "", type: "narrator" } as const)
      : actorFromMap;
    assertDefined(actor, "Actor participant not found in scenario");
    const actorName = actorIsNarrator ? "Narrator" : actor.name;

    // Enrich turn DTO with events
    const eventsByTurn = eventDTOsByTurn(derivation.events);
    const enrichedTurns = attachEventsToTurns(turns, eventsByTurn);
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

    return {
      turns: enrichedTurns,
      characters,
      chapterSummaries,
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
      lorebooks,
    };
  }
}
