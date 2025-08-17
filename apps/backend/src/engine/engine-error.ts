import type { TurnErr } from "@/engine/invariants/turn";
import type { TurnContentErr } from "@/engine/invariants/turn-content";
import type { TurnChapterErr } from "@/engine/invariants/turn-progression";

export class EngineError extends Error {
  constructor(public readonly code: TurnErr | TurnChapterErr | TurnContentErr) {
    super(`Engine invariant violation: ${code}`);
    this.name = "EngineError";
  }
}
