import { z } from "zod";
import type { TimelineConcernSpec, TimelineEventSpec } from "../types.js";

const presenceChangeEventSchema = z.object({
  participantId: z.string(),
  active: z.boolean(),
  status: z.string().optional(),
});

export type PresenceChangeEvent = z.infer<typeof presenceChangeEventSchema>;
type ParticipantId = string;
export type PresenceState = {
  participantPresence: Record<ParticipantId, { active: boolean; status?: string }>;
};

export const presenceChangeSpec: TimelineEventSpec<"presence_change", PresenceChangeEvent> = {
  kind: "presence_change",
  latest: 1,
  schema: presenceChangeEventSchema,
  parse: ({ payload }) => ({
    version: 1,
    payload: presenceChangeEventSchema.parse(payload),
  }),
  toPrompt: (ev) => {
    const status =
      ev.payload.status || ev.payload.active ? `Enters the scene.` : `Leaves the scene.`;
    // TODO: how to get character names into this? maybe just save it in event payload for simplicity
    return `${ev.payload.participantId}: ${status}`;
  },
};

export const presenceConcern: TimelineConcernSpec<"presence", "presence_change", PresenceState> = {
  name: "presence",
  eventKinds: ["presence_change"],
  // Characters not listed are assumed to be present
  initial: () => ({ participantPresence: {} }),
  step: (s, ev) => ({
    participantPresence: {
      ...s.participantPresence,
      [ev.payload.participantId]: { active: ev.payload.active, status: ev.payload.status },
    },
  }),
};
