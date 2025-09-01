import type { SqliteDatabase } from "@storyforge/db";
import type { TurnGenCtx } from "@storyforge/gentasks";

interface BuildContextArgs {
  scenarioId: string;
  actorParticipantId: string;
  intent: { kind: NewIntent["kind"] };
}

export class TurngenContextBuilder {
  constructor(private db: SqliteDatabase) {}

  /**
   * Hydrates a TurnGenContext for use in turn generation.
   */
  async buildContext(args: BuildContextArgs): Promise<TurnGenCtx> {
    const { scenarioId, actorParticipantId } = args;

    return {
      turns: [],
      characters: [],
      currentIntent: {
        constraint,
      },
      chapterSummaries: [],
      globals: {},
    };
  }

  private getCurrentIntent();
}
