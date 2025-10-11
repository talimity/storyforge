import type { LorebookData } from "./schema.js";

export type LorebookHasher = (input: string) => string;

export function computeLorebookHash(data: LorebookData, hash: LorebookHasher): string {
  const canonicalEntries = data.entries
    .map<CanonicalEntry>((entry) => ({
      keys: [...entry.keys].sort(localeCompare),
      secondary_keys: entry.secondary_keys
        ? [...entry.secondary_keys].sort(localeCompare)
        : undefined,
      content: entry.content,
      enabled: entry.enabled,
      insertion_order: entry.insertion_order,
      case_sensitive: entry.case_sensitive,
      selective: entry.selective,
      constant: entry.constant,
      position: entry.position,
      use_regex: entry.use_regex,
    }))
    .sort(compareCanonicalEntries);

  const canonical: CanonicalLorebook = {
    scan_depth: data.scan_depth ?? null,
    token_budget: data.token_budget ?? null,
    recursive_scanning: data.recursive_scanning ?? null,
    entries: canonicalEntries,
  };

  const json = JSON.stringify(canonical);
  return hash(json);
}

type CanonicalEntry = {
  keys: string[];
  secondary_keys?: string[];
  content: string;
  enabled: boolean;
  insertion_order: number;
  case_sensitive?: boolean;
  selective?: boolean;
  constant?: boolean;
  position?: string | number;
  use_regex?: boolean;
};

type CanonicalLorebook = {
  scan_depth: number | null;
  token_budget: number | null;
  recursive_scanning: boolean | null;
  entries: CanonicalEntry[];
};

function compareCanonicalEntries(left: CanonicalEntry, right: CanonicalEntry): number {
  if (left.insertion_order !== right.insertion_order) {
    return left.insertion_order - right.insertion_order;
  }

  if (left.content !== right.content) {
    return left.content.localeCompare(right.content);
  }

  const leftKey = left.keys.join("::");
  const rightKey = right.keys.join("::");
  if (leftKey !== rightKey) {
    return leftKey.localeCompare(rightKey);
  }

  const leftSecondary = (left.secondary_keys ?? []).join("::");
  const rightSecondary = (right.secondary_keys ?? []).join("::");
  return leftSecondary.localeCompare(rightSecondary);
}

function localeCompare(a: string, b: string): number {
  return a.localeCompare(b);
}
