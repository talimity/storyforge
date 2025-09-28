import type { SqliteTxLike } from "@storyforge/db";
import { TimelineStateDeriver } from "@storyforge/timeline-events";
import { TimelineEventLoader } from "./loader.js";

export class TimelineStateService {
  private readonly loader: TimelineEventLoader;
  private readonly deriver: TimelineStateDeriver;

  constructor(db: SqliteTxLike) {
    this.loader = new TimelineEventLoader(db);
    this.deriver = new TimelineStateDeriver(this.loader);
  }

  async deriveState(scenarioId: string, leafTurnId?: string | null) {
    return this.deriver.run({ scenarioId, leafTurnId });
  }
}
