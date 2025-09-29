// do not put runtime code here or it will cause dependency cycles
import type { z } from "zod";
import type { TimelineEventPayloadMap, TimelineState } from "./registry.js";

export type TimelineEventVersion = number;

export interface TimelineEventSpec<K extends string, P> {
  kind: K;
  latest: TimelineEventVersion;
  schema: z.ZodType<P>;
  /**
   * Given a raw event from storage containing an untyped payload and a version
   * number, parses the event data into a typed payload. If the event data is
   * from an older version, it may be converted to the latest version.
   */
  parse: (event: { payloadVersion: number; payload: unknown }) => { version: number; payload: P };
  /** Optional formatter for prompt-facing DTOs using the derived state post-event. */
  toPrompt?: (ev: TimelineEventEnvelope<K, P>, state: TimelineState) => string;
}

export type TimelineEventEnvelope<K extends string = AnyTimelineEventKind, P = unknown> = {
  id: string;
  turnId: string | null;
  orderKey: string;
  kind: K;
  payloadVersion: number;
  payload: P;
};

export type RawTimelineEvent = Omit<TimelineEventEnvelopeOf<AnyTimelineEventKind>, "payload"> & {
  payload: Record<string, unknown>;
};

export type AnyTimelineEventKind = keyof TimelineEventPayloadMap;
export type TimelineEventEnvelopeOf<K extends AnyTimelineEventKind> = TimelineEventEnvelope<
  K,
  TimelineEventPayloadMap[K]
>;

export interface TimelineConcernSpec<N extends string, Ks extends AnyTimelineEventKind, S> {
  name: N;
  eventKinds: readonly Ks[];
  initial: () => S;
  schema: z.ZodType<S>;
  /** Reducer for handling events of the specified kinds */
  step: (state: S, ev: TimelineEventEnvelopeOf<Ks>) => S;
}
