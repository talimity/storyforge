import type { NewIntent } from "@storyforge/db";
import type { TurnGenCtx } from "@storyforge/gentasks";

interface BuildContextArgs {
  scenarioId: string;
  actorParticipantId: string;
  intent: { kind: NewIntent };
}

export class TurngenContextBuilder {
  async buildContext(args: BuildContextArgs): Promise<TurnGenCtx> {
    const { scenarioId, actorParticipantId } = args;

    return {
      turns: [],
      characters: [],
      stepInputs: {},
      currentIntent: {
        kind: "direct_control",
        description: "Direct Control",
      },
      chapterSummaries: [],
      globals: {
        stCurrentCharName: `tbd ${actorParticipantId}`,
        stPersonaName: "tbd",
        scenarioDescription: `tbd ${scenarioId}`,
      },
    };
  }
}
