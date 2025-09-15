/**
 * Resolves a dotted path like "item.summary" or "intent.description" against a scope object.
 * Also supports bracketed array access like "item.examples[0]".
 *
 * If scope object contains a "globals" property, paths which don't exist in the main scope
 * will be resolved against that.
 * @param scope - The object to resolve against
 * @param path - Dotted path like "item.summary" or "item.examples[0]"
 * @returns The resolved value or undefined if not found
 */
export function resolvePath(scope: unknown, path: string): unknown {
  const isRecord = (v: unknown): v is Record<string | number | symbol, unknown> =>
    !!v && typeof v === "object";

  const resolveFrom = (
    obj: Record<string | number | symbol, unknown> | undefined
  ): { found: boolean; value: unknown } => {
    if (!obj) return { found: false, value: undefined };
    let current: unknown = obj;
    const parts = parsePath(path);
    for (const part of parts) {
      if (!isRecord(current)) return { found: false, value: undefined };
      const container = current;
      if (!Object.hasOwn(container, part)) {
        return { found: false, value: undefined };
      }
      current = container[part];
    }
    return { found: true, value: current };
  };

  if (!isRecord(scope)) return undefined;

  const direct = resolveFrom(scope);
  if (direct.found) return direct.value;

  const globals = scope.globals;
  const viaGlobals = resolveFrom(isRecord(globals) ? globals : undefined);
  if (viaGlobals.found) return viaGlobals.value;

  return undefined;
}

/**
 * Parses a path string into parts, handling both dot notation and bracketed access.
 * Examples:
 * - "item.summary" -> ["item", "summary"]
 * - "item.examples.[0]" -> ["item", "examples", "0"]
 * - "arr[0].name" -> ["arr", "0", "name"]
 */
export function parsePath(path: string): string[] {
  const parts: string[] = [];
  let current = "";
  let i = 0;

  while (i < path.length) {
    const char = path[i];
    if (char === ".") {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else if (char === "[") {
      if (current) {
        parts.push(current);
        current = "";
      }
      const closeIndex = path.indexOf("]", i);
      if (closeIndex !== -1) {
        const bracketContent = path.slice(i + 1, closeIndex);
        parts.push(bracketContent);
        i = closeIndex;
      } else {
        current += char;
      }
    } else {
      current += char;
    }
    i++;
  }

  if (current) parts.push(current);
  return parts;
}
