/* biome-ignore-all lint/suspicious/noExplicitAny: too dumb and lazy to type
 * this shit correctly */
// do not put runtime code here or it will cause dependency cycles
import type { z } from "zod";
import type { TimelineEventPayloadMap } from "./registry.js";

export type TimelineEventVersion = number;

export interface TimelineEventSpec<K extends string, P, H = unknown> {
  kind: K;
  latest: TimelineEventVersion;
  schema: z.ZodType<P>;
  /**
   * Given a raw event from storage containing an untyped payload and a version
   * number, parses the event data into a typed payload. If the event data is
   * from an older version, it may be converted to the latest version.
   */
  parse: (event: { payloadVersion: number; payload: unknown }) => { version: number; payload: P };
  /** Optional formatter for prompt-facing DTOs (uses hint if present) */
  toPrompt?: (ev: TimelineEventEnvelope<K, P>, hint?: H) => string;
}

export type RawTimelineEvent = Omit<TimelineEventEnvelopeOf<AnyTimelineEventKind>, "payload"> & {
  payload: Record<string, unknown>;
};

export type TimelineEventEnvelope<K extends string = AnyTimelineEventKind, P = unknown> = {
  id: string;
  turnId: string;
  position: "before" | "after";
  orderKey: string;
  kind: K;
  payloadVersion: number;
  payload: P;
};

export type AnyTimelineEventKind = keyof TimelineEventPayloadMap;
export type TimelineEventEnvelopeOf<K extends AnyTimelineEventKind> = TimelineEventEnvelope<
  K,
  TimelineEventPayloadMap[K]
>;

export type HintFns<K extends AnyTimelineEventKind, Final> = Partial<{
  [P in K]: (state: Final, ev: TimelineEventEnvelopeOf<P>) => unknown;
}>;

export interface TimelineConcernSpec<
  Name extends string,
  Kinds extends AnyTimelineEventKind,
  Final,
> {
  name: Name;
  eventKinds: readonly Kinds[];
  initial: () => Final;
  /** Reducer for handling events of the specified kinds */
  step: (state: Final, ev: TimelineEventEnvelopeOf<Kinds>) => Final;
  /**
   * Optional per-kind hint functions for constructing timeline DTOs, such
   * as to receive the derived chapter number from each chapter_break event.
   */
  hints?: HintFns<Kinds, Final>;
}
