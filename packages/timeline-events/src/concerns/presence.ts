import { z } from "zod";
import type { TimelineConcernSpec, TimelineEventSpec } from "../types.js";

const presenceChangeEventSchema = z.object({
  participantId: z.string(),
  active: z.boolean(),
  status: z.string().nullish(),
});

const presenceStateSchema = z.object({
  participantPresence: z.record(
    z.string(),
    z.object({ active: z.boolean(), status: z.string().nullish() })
  ),
});

export type PresenceChangeEvent = z.infer<typeof presenceChangeEventSchema>;
export type PresenceState = z.infer<typeof presenceStateSchema>;

export const presenceChangeSpec: TimelineEventSpec<"presence_change", PresenceChangeEvent> = {
  kind: "presence_change",
  latest: 1,
  schema: presenceChangeEventSchema,
  parse: ({ payload }) => ({
    version: 1,
    payload: presenceChangeEventSchema.parse(payload),
  }),
  toPrompt: (ev, _state) => {
    const status =
      ev.payload.status || ev.payload.active ? `Enters the scene.` : `Leaves the scene.`;
    // TODO: how to get character names into this? maybe just save it in event payload for simplicity
    return `${ev.payload.participantId}: ${status}`;
  },
};

export const presenceConcern: TimelineConcernSpec<"presence", "presence_change", PresenceState> = {
  name: "presence",
  eventKinds: ["presence_change"],
  schema: presenceStateSchema,
  // Characters not listed are assumed to be present
  initial: () => ({ participantPresence: {} }),
  step: (s, ev) => ({
    participantPresence: {
      ...s.participantPresence,
      [ev.payload.participantId]: { active: ev.payload.active, status: ev.payload.status },
    },
  }),
};
