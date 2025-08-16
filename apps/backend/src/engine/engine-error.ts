import type { TurnErr } from "@/engine/invariants/turn";
import type { TurnChapterErr } from "@/engine/invariants/turn-progression";

export class EngineError extends Error {
  constructor(public readonly code: TurnErr | TurnChapterErr) {
    super(`Engine validation failed: ${code}`);
    this.name = "EngineError";
  }
}
