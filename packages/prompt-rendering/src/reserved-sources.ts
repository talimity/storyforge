export const RESERVED_SOURCES = ["$item", "$index", "$parent", "$globals", "$ctx"] as const;

export type ReservedSource = (typeof RESERVED_SOURCES)[number];

export function isReservedSource(name: string): name is ReservedSource {
  return (RESERVED_SOURCES as readonly string[]).includes(name);
}

// Argument shapes for reserved sources (runtime-validated only)
export type ItemArgs = { path?: string } | undefined;
export type IndexArgs = undefined | Record<string, never>;
export type ParentArgs = { level?: number; path?: string } | undefined;
export type PathArgs = { path?: string } | undefined;
