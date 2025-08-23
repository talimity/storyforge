/**
 * Very simple mustache-style templating for leaf strings.
 * Only supports variable substitution with dotted paths, no control flow.
 */

import type { CompiledLeafFunction } from "./types";

/**
 * Compiles a template string with {{variable}} patterns into a function.
 * @param template - String template with {{path.to.value}} patterns
 * @returns Function that takes a scope and returns the interpolated string
 */
export function compileLeaf(template: string): CompiledLeafFunction {
  // Find all {{...}} patterns
  // Use a more precise regex that doesn't match nested braces
  const variables: Array<{ start: number; end: number; path: string }> = [];
  const regex = /\{\{([^{}]+)}}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    variables.push({
      start: match.index,
      end: match.index + match[0].length,
      path: match[1].trim(),
    });
  }

  // If no variables, return the template as-is
  if (variables.length === 0) {
    return () => template;
  }

  // Build the interpolation function
  return (scope: unknown) => {
    let result = "";
    let lastEnd = 0;

    for (const variable of variables) {
      // Add the literal text before this variable
      result += template.slice(lastEnd, variable.start);

      // Resolve and add the variable value
      const value = resolvePath(scope, variable.path);
      result += toStringSafe(value);

      lastEnd = variable.end;
    }

    // Add any remaining literal text
    result += template.slice(lastEnd);

    return result;
  };
}

/**
 * Converts a value to a string safely.
 */
function toStringSafe(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint")
    return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

/**
 * Resolves a dotted path like "item.summary" or "ctx.intent.description" against a scope object.
 * Also supports bracketed array access like "item.examples.[0]".
 * @param scope - The object to resolve against
 * @param path - Dotted path like "item.summary" or "item.examples.[0]"
 * @returns The resolved value or undefined if not found
 */
function resolvePath(scope: unknown, path: string): unknown {
  if (!scope || typeof scope !== "object") {
    return undefined;
  }

  const parts = parsePath(path);
  let current = scope;

  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    // biome-ignore lint/suspicious/noExplicitAny: not worth parameterizing everything to avoid this
    current = (current as any)[part];
  }

  return current;
}

/**
 * Parses a path string into parts, handling both dot notation and bracketed access.
 * Examples:
 * - "item.summary" -> ["item", "summary"]
 * - "item.examples.[0]" -> ["item", "examples", "0"]
 * - "arr.[0].name" -> ["arr", "0", "name"]
 */
function parsePath(path: string): string[] {
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
      // If we have accumulated content, push it first
      if (current) {
        parts.push(current);
        current = "";
      }

      // Find the closing bracket
      const closeIndex = path.indexOf("]", i);
      if (closeIndex !== -1) {
        const bracketContent = path.slice(i + 1, closeIndex);
        parts.push(bracketContent);
        i = closeIndex; // Skip to the closing bracket
      } else {
        // Malformed bracket, treat as regular character
        current += char;
      }
    } else {
      current += char;
    }

    i++;
  }

  // Add any remaining content
  if (current) {
    parts.push(current);
  }

  return parts;
}
