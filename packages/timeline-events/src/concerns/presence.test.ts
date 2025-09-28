import { describe, expect, it } from "vitest";
import type { TimelineEventEnvelopeOf } from "../types.js";
import { presenceConcern } from "./presence.js";

function makePresenceEvent(
  overrides: Partial<TimelineEventEnvelopeOf<"presence_change">> & {
    payload: { participantId: string; active: boolean; status?: string | null };
  }
): TimelineEventEnvelopeOf<"presence_change"> {
  return {
    id: overrides.id ?? `presence-${overrides.payload.participantId}`,
    turnId: overrides.turnId ?? "turn-1",
    orderKey: overrides.orderKey ?? "m",
    kind: "presence_change",
    payloadVersion: overrides.payloadVersion ?? 1,
    payload: overrides.payload,
  };
}

describe("presenceConcern", () => {
  it("starts with an empty presence map", () => {
    expect(presenceConcern.initial()).toEqual({ participantPresence: {} });
  });

  it("adds and updates presence entries", () => {
    const initial = presenceConcern.initial();

    const afterFirst = presenceConcern.step(
      initial,
      makePresenceEvent({
        payload: { participantId: "char-A", active: true, status: "joins" },
      })
    );
    expect(afterFirst.participantPresence).toEqual({
      "char-A": { active: true, status: "joins" },
    });

    const afterSecond = presenceConcern.step(
      afterFirst,
      makePresenceEvent({
        payload: { participantId: "char-A", active: false, status: null },
        orderKey: "n",
      })
    );

    expect(afterSecond.participantPresence).toEqual({
      "char-A": { active: false, status: null },
    });
  });

  it("tracks multiple participants independently", () => {
    const initial = presenceConcern.initial();
    const withFirst = presenceConcern.step(
      initial,
      makePresenceEvent({ payload: { participantId: "char-A", active: true, status: null } })
    );
    const withSecond = presenceConcern.step(
      withFirst,
      makePresenceEvent({
        payload: { participantId: "char-B", active: false, status: "stealth" },
      })
    );

    expect(withSecond.participantPresence).toEqual({
      "char-A": { active: true, status: null },
      "char-B": { active: false, status: "stealth" },
    });
  });
});
