import type { TurnErr } from "./services/timeline/invariants/turn.js";
import type { TurnContentErr } from "./services/timeline/invariants/turn-content.js";

export class EngineError extends Error {
  constructor(public readonly code: TurnErr | TurnContentErr) {
    super(`Engine invariant violation: ${code}`);
    this.name = "EngineError";
  }
}
