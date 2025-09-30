/* biome-ignore-all lint/suspicious/noExplicitAny: Too dumb and lazy to
 * parameterize Deriver properly after fighting with TS for hours
 * unsuccessfully. We keep the bad casts mostly isolated to this module */

import {
  type TimelineState,
  timelineConcerns,
  timelineEventKindToConcern,
  timelineEvents,
} from "./registry.js";
import type { AnyTimelineEventKind, RawTimelineEvent, TimelineEventEnvelopeOf } from "./types.js";

export type TimelineDeriveMode = { mode: "final" } | { mode: "events" };

export type DerivedTimelineEvent = TimelineEventEnvelopeOf<AnyTimelineEventKind> & {
  state: TimelineState;
};

export type TimelineDerivationResult =
  | { final: TimelineState; events: DerivedTimelineEvent[] }
  | { final: TimelineState; events: [] };

export interface TimelineEventDataLoader {
  loadOrderedEventsAlongPath(
    scenarioId: string,
    leafTurnId: string | null
  ): Promise<RawTimelineEvent[]>;
}

export class TimelineStateDeriver {
  // TODO: memoize the derivation result?

  constructor(private readonly loader: TimelineEventDataLoader) {}

  async run(args: {
    scenarioId: string;
    leafTurnId?: string | null;
    mode?: TimelineDeriveMode;
  }): Promise<TimelineDerivationResult> {
    const { scenarioId, leafTurnId = null, mode = { mode: "events" } } = args;
    const collectEvents = mode.mode === "events";
    const rows = await this.loader.loadOrderedEventsAlongPath(scenarioId, leafTurnId);

    // Parsed envelopes remain a union across all kinds.
    const parsedRows = rows.map((row) => {
      const { turnIsGhost, ...rest } = row;
      const spec = timelineEvents[row.kind];

      // Depending on whether the row was fetched with raw sql or the drizzle
      // querybuilder, payload can be a parsed object or still the string.
      const normalized = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;

      const { version, payload } = spec.parse({
        payloadVersion: row.payloadVersion,
        payload: normalized,
      });
      return {
        envelope: {
          ...rest,
          payloadVersion: version,
          payload,
        } satisfies TimelineEventEnvelopeOf<AnyTimelineEventKind>,
        turnIsGhost,
      };
    });

    // Initialize state from concerns
    const stateByConcern = Object.fromEntries(
      Object.entries(timelineConcerns).map(([name, c]) => [name, c.initial()])
    ) as TimelineState;

    const derivedEvents: DerivedTimelineEvent[] = [];

    for (const { envelope: ev, turnIsGhost } of parsedRows) {
      const concernName = timelineEventKindToConcern[ev.kind];
      const concern = timelineConcerns[concernName];

      if (!turnIsGhost || ev.turnId === null) {
        // Apply reducer; we know this concern can handle this event type due to runtime mapping.
        stateByConcern[concernName] = (concern as any).step(stateByConcern[concernName], ev);
      }

      if (collectEvents) {
        derivedEvents.push({
          ...ev,
          state: cloneState(stateByConcern),
        });
      }
    }

    const finalState = collectEvents ? cloneState(stateByConcern) : stateByConcern;

    if (collectEvents) {
      return { final: finalState, events: derivedEvents };
    }

    return { final: finalState, events: [] };
  }
}

function cloneState(state: TimelineState): TimelineState {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state));
}
