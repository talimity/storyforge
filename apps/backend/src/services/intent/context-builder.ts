import type { NewIntent, SqliteTxLike } from "@storyforge/db";
import type { TurnGenCtx } from "@storyforge/gentasks";
import { assertDefined } from "@storyforge/utils";
import { getSummariesForPath } from "../chapter-summaries/chapter-summaries.queries.js";
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

    const data = await this.loadEverything(this.scenarioId, leafTurnId);

    const { characters, userProxyName, byParticipantId } = data.charaCtx;
    const actorFromMap = byParticipantId.get(actorParticipantId);
    const actorIsNarrator = !actorFromMap;
    const actor = actorIsNarrator
      ? ({ id: "narrator", name: "Narrator", description: "", type: "narrator" } as const)
      : actorFromMap;
    assertDefined(actor, "Actor participant not found in scenario");
    const actorName = actorIsNarrator ? "Narrator" : actor.name;

    // Enrich turn DTO with events
    const eventsByTurn = eventDTOsByTurn(data.derivation.events);
    const enrichedTurns = attachEventsToTurns(data.turns, eventsByTurn);
    const nextTurnNumber = (data.turns.at(-1)?.turnNo ?? 0) + 1;
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
      chapterSummaries: data.chapterSummaries,
      lorebooks: data.lorebooks,
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
        scenario: data.scenario.description,
        isNarratorTurn: actorIsNarrator,
      },
    };
  }

  private async loadEverything(scenarioId: string, leafTurnId: string | null) {
    const stateService = new TimelineStateService(this.db);

    const [charaCtx, derivation, scenario, turns, lorebooks, chapterSummaries] = await Promise.all([
      loadScenarioCharacterContext(this.db, scenarioId),
      stateService.deriveState(scenarioId, leafTurnId),
      loadScenarioMetadata(this.db, scenarioId),
      getFullTimelineTurnCtx(this.db, { leafTurnId, scenarioId }),
      loadScenarioLorebookAssignments(this.db, scenarioId),
      getSummariesForPath(this.db, { scenarioId, leafTurnId }),
    ]);

    return { charaCtx, derivation, scenario, turns, lorebooks, chapterSummaries };
  }
}
