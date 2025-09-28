/* biome-ignore-all lint/suspicious/noExplicitAny: Too dumb and lazy to
 * parameterize Deriver properly after fighting with TS for hours
 * unsuccessfully. We keep the bad casts mostly isolated to this module */

import { type TimelineState, timelineConcerns, timelineEvents } from "./registry.js";
import type { AnyTimelineEventKind, RawTimelineEvent, TimelineEventEnvelopeOf } from "./types.js";

// export type TimelineDeriveRunMode =
//   | { mode: "final" }
//   | { mode: "perTurn"; turnIds: readonly string[] }
//   | { mode: "allEvents" };

export type TimelineDerivationResult = {
  final: TimelineState;
  // eventId -> { [concernName]: hint }
  hints: Map<string, Partial<Record<keyof TimelineState, unknown>>>;
  events: RawTimelineEvent[];
};

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
    // mode: TimelineDeriveRunMode;
  }): Promise<TimelineDerivationResult> {
    const { scenarioId, leafTurnId = null } = args;
    const rows = await this.loader.loadOrderedEventsAlongPath(scenarioId, leafTurnId);

    // Parsed envelopes remain a union across all kinds.
    const envelopes: TimelineEventEnvelopeOf<AnyTimelineEventKind>[] = rows.map((row) => {
      const spec = timelineEvents[row.kind as keyof typeof timelineEvents];

      // Depending on whether the row was fetched with raw sql or the drizzle
      // querybuilder, payload can be a parsed object or still the string.
      const normalized = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;

      const { version, payload } = spec.parse({
        payloadVersion: row.payloadVersion,
        payload: normalized,
      });
      return {
        ...row,
        payloadVersion: version,
        payload,
      };
    });

    // Initialize final state from concerns
    const final = Object.fromEntries(
      Object.entries(timelineConcerns).map(([name, c]) => [name, c.initial()])
    ) as TimelineState;

    const hints = new Map<string, Partial<Record<keyof TimelineState, unknown>>>();

    // Reduce each concern independently
    for (const [name, concern] of Object.entries(timelineConcerns) as [
      keyof TimelineState,
      (typeof timelineConcerns)[keyof TimelineState],
    ][]) {
      let state = final[name];

      for (const ev of envelopes) {
        // intersection of every concern's eventKinds is `never` so we have to
        // cast.
        if (!(concern.eventKinds as string[]).includes(ev.kind)) {
          continue;
        }

        // Apply reducer; we know this concern can handle this event type due
        // to runtime check against the concern's eventKinds.
        state = (concern as any).step(state, ev);

        // TODO: I am not sure if `perTurn` mode hints will work, because to
        // correctly calculate hints (such as chapter numbers) we would need to
        // run the hint function for ALL turns from the top, not just those
        // within the selected turn IDs (since the state of selected IDs depends
        // on the state of earlier turns that may not have been requested).
        // const wantsHints =
        //   args.mode.mode === "allEvents" ||
        //   (args.mode.mode === "perTurn" && args.mode.turnIds.includes(ev.turnId));

        if (/* wantsHints && */ concern.hints) {
          const hintFn = (concern.hints as any)[ev.kind] as
            | ((s: unknown, e: unknown) => unknown)
            | undefined;
          if (hintFn) {
            const h = hintFn(state, ev);
            if (h !== undefined) {
              const bag = hints.get(ev.id) ?? {};
              bag[name] = h;
              hints.set(ev.id, bag);
            }
          }
        }
      }

      // state is not narrowed to a particular concern here, so we have to cast.
      // it is absolutely not worth it to try to type this correctly, runtime
      // checks and unit tests can restore safety.
      final[name] = state as any;
    }

    return {
      final,
      hints,
      events: /* args.mode.mode === "allEvents" ? */ rows /* : undefined, */,
    };
  }

  // After consideration I don't think this "modes" API is useful. The only work
  // we short circuit in the different modes is the hint functions, which cost
  // basically nothing. A more useful API optimization might be to only
  // calculate the full state for a single concern and skip any unrelated
  // events.

  // finalState(scenarioId: string, leafTurnId: string | null) {
  //   return this.run({ scenarioId, leafTurnId, mode: { mode: "final" } });
  // }
  // hintsFor(scenarioId: string, leafTurnId: string | null, turnIds: string[]) {
  //   return this.run({ scenarioId, leafTurnId, mode: { mode: "perTurn", turnIds } });
  // }
  // full(scenarioId: string, leafTurnId: string | null) {
  //   return this.run({ scenarioId, leafTurnId, mode: { mode: "allEvents" } });
  // }
}
