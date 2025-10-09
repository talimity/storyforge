import type { LorebookData } from "./schema.js";
import { lorebookDataSchema } from "./schema.js";

export function parseLorebookData(value: unknown): LorebookData {
  return lorebookDataSchema.parse(value);
}

export function normalizeLorebookData(data: LorebookData): LorebookData {
  return {
    ...data,
    extensions: data.extensions ?? {},
    entries: data.entries.map((entry) => ({
      ...entry,
      extensions: entry.extensions ?? {},
      keys: [...entry.keys],
      secondary_keys: entry.secondary_keys ? [...entry.secondary_keys] : undefined,
    })),
  };
}
