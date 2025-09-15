/**
 * Very simple mustache-style templating for leaf strings.
 * Only supports variable substitution with dotted paths, no control flow.
 */

import { resolvePath } from "./path-resolver.js";
import type { CompiledLeafFunction } from "./types.js";

const MAX_NESTED_EXPANSIONS = 5;

/**
 * Compiles a template string with {{variable}} patterns into a function.
 * @param template - String template with {{path.to.value}} patterns
 * @returns Function that takes a scope and returns the interpolated string
 */
export function compileLeaf(template: string): CompiledLeafFunction {
  return compileLeafInner(template, 0);
}

/**
 * Recursive compileLeaf implementation.
 */
function compileLeafInner(template: string, depth: number): CompiledLeafFunction {
  // Base case
  if (depth > MAX_NESTED_EXPANSIONS) {
    return () => template;
  }

  // Find all {{...}} patterns, not including nested ones
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

      // Resolve value
      const raw = resolvePath(scope, variable.path);
      let val = raw;

      // Recurse if value also contains a potential variable
      if (typeof raw === "string" && raw.includes("{{")) {
        val = compileLeafInner(raw, depth + 1)(scope);
      }

      result += toStringSafe(val);
      lastEnd = variable.end;
    }

    // Add any remaining literal text
    result += template.slice(lastEnd);

    // console.log("leaf", template, "->", result?.slice(0, 50));
    // console.log("scope", JSON.stringify(scope, null, 2).slice(0, 50));

    return result;
  };
}

/**
 * Converts a value to a string without throwing.
 */
function toStringSafe(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") {
    return String(v);
  }
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}
