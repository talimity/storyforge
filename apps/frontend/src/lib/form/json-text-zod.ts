// apps/frontend/src/lib/form/json-text-zod.ts
import { z } from "zod";

// For TypeScript readability
export type JsonTextOutput<T extends z.ZodTypeAny> = z.output<T>;
export type JsonTextInput = string;

/**
 * Accepts a JSON *string* during form editing, parses once, then pipes to `inner`.
 * - `allowEmpty`: treat "" as {} or a provided `emptyValue`
 * - `defaultValue`: initial string value (pretty-printed) used by form init
 */
export function jsonText<T extends z.ZodTypeAny>(
  inner: T,
  opts?: {
    defaultValue?: unknown; // default object value -> pretty-printed as the field's string default
    allowEmpty?: boolean; // allow "" in the form field
    emptyValue?: unknown; // what "" should become (default: {})
    pretty?: number; // JSON indentation, default 2
  }
) {
  const { defaultValue = {}, allowEmpty = false, emptyValue = {}, pretty = 2 } = opts ?? {};

  return z
    .string()
    .default(JSON.stringify(defaultValue, null, pretty))
    .unwrap()
    .transform((raw, ctx) => {
      if (allowEmpty && raw.trim().length === 0) {
        return emptyValue;
      }

      let parsed: unknown = emptyValue;
      try {
        parsed = JSON.parse(raw);
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid JSON" });
        return parsed;
      }

      if (parsed) {
        const result = inner.safeParse(parsed);
        if (!result.success) {
          ctx.addIssue(z.prettifyError(result.error));
        }
      }

      return parsed;
    })
    .pipe(inner);
}
