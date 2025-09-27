/** biome-ignore-all lint/suspicious/noExplicitAny: not worth it */
import type { TimelineConcernSpec } from "./types.js";

/**
 * Ensure concerns match declared final shape.
 */
export function defineConcerns<Final extends Record<string, any>>() {
  return <Cs extends { [K in keyof Final]: TimelineConcernSpec<K & string, any, Final[K]> }>(
    concerns: Cs
  ) => concerns;
}

/** Light, explicit binder for event specs (kept simple on purpose). */
export function defineEvents<Map extends Record<string, any>>(events: Map) {
  return events;
}
