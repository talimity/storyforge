import type { TurnErr } from "./services/timeline/invariants/turn.js";
import type { TurnContentErr } from "./services/timeline/invariants/turn-content.js";
import type { TurnChapterErr } from "./services/timeline/invariants/turn-progression.js";

export class EngineError extends Error {
  constructor(public readonly code: TurnErr | TurnChapterErr | TurnContentErr) {
    super(`Engine invariant violation: ${code}`);
    this.name = "EngineError";
  }
}
