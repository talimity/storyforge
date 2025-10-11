import type { LorebookData } from "@storyforge/contracts";
import { createId } from "@storyforge/utils";
import { CharacterBookSchema } from "../../character/utils/parse-tavern-card.js";

interface NormalizeOptions {
  filename?: string;
}

export function normalizeSillyTavernLorebook(
  raw: unknown,
  options: NormalizeOptions = {}
): LorebookData | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const record = raw as Record<string, unknown>;

  if (record.spec === "chara_card_v2") {
    const data = (record as { data?: Record<string, unknown> }).data;
    const characterBook = data?.character_book;
    if (!characterBook) return undefined;
    const parsed = CharacterBookSchema.parse(characterBook);
    const name = typeof data?.name === "string" ? data.name : undefined;
    return fromCharacterBook(parsed, name ?? options.filename);
  }

  if (isWorldInfoLorebook(record)) {
    return fromWorldInfo(record, options.filename);
  }

  return undefined;
}

function fromCharacterBook(
  book: ReturnType<typeof CharacterBookSchema.parse>,
  fallbackName?: string
): LorebookData {
  return {
    name: book.name ?? deriveNameFromFilename(fallbackName),
    description: book.description ?? undefined,
    scan_depth: book.scan_depth ?? undefined,
    token_budget: book.token_budget ?? undefined,
    recursive_scanning: book.recursive_scanning ?? undefined,
    extensions: book.extensions ?? {},
    entries: book.entries.map((entry) => ({
      keys: [...entry.keys],
      content: entry.content,
      extensions: entry.extensions ?? {},
      enabled: entry.enabled,
      insertion_order: entry.insertion_order,
      case_sensitive: entry.case_sensitive,
      name: entry.name,
      priority: entry.priority,
      id: entry.id || createId(),
      comment: entry.comment,
      selective: entry.selective,
      secondary_keys: entry.secondary_keys ? [...entry.secondary_keys] : undefined,
      constant: entry.constant,
      position:
        typeof entry.position === "string" &&
        (entry.position === "before_char" || entry.position === "after_char")
          ? entry.position
          : undefined,
    })),
  };
}

function fromWorldInfo(raw: Record<string, unknown>, filename?: string): LorebookData | undefined {
  const entriesSource = raw.entries;
  if (!entriesSource || typeof entriesSource !== "object") {
    return undefined;
  }

  const entryValues = Array.isArray(entriesSource)
    ? entriesSource
    : Object.values(entriesSource as Record<string, unknown>);

  const entries = entryValues
    .map((entry, index) => normalizeWorldInfoEntry(entry, index))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (entries.length === 0) {
    return undefined;
  }

  const {
    name,
    description,
    scan_depth,
    token_budget,
    recursive_scanning,
    extensions,
    entries: _ignoredEntries,
    ...rest
  } = raw;

  const topLevelExtensions: Record<string, unknown> = {};
  if (isRecord(extensions)) {
    Object.assign(topLevelExtensions, extensions);
  }
  if (Object.keys(rest).length > 0) {
    Object.assign(topLevelExtensions, rest);
  }

  return {
    name: typeof name === "string" && name.length > 0 ? name : deriveNameFromFilename(filename),
    description:
      typeof description === "string" && description.length > 0 ? description : undefined,
    scan_depth: typeof scan_depth === "number" ? scan_depth : undefined,
    token_budget: typeof token_budget === "number" ? token_budget : undefined,
    recursive_scanning: typeof recursive_scanning === "boolean" ? recursive_scanning : undefined,
    extensions: topLevelExtensions,
    entries,
  };
}

function normalizeWorldInfoEntry(entry: unknown, index: number) {
  if (!isRecord(entry)) {
    return undefined;
  }

  const {
    keys,
    key,
    secondary_keys,
    keysecondary,
    content,
    comment,
    constant,
    selective,
    order,
    insertion_order,
    enabled,
    disable,
    case_sensitive,
    priority,
    id,
    name,
    position,
    use_regex,
    extensions,
    ...rest
  } = entry;

  const normalizedExtensions: Record<string, unknown> = {};
  if (isRecord(extensions)) {
    Object.assign(normalizedExtensions, extensions);
  }
  if (Object.keys(rest).length > 0) {
    Object.assign(normalizedExtensions, rest);
  }

  const resolvedKeys = mergeStringArrays(keys, key);
  const resolvedSecondary = mergeStringArrays(secondary_keys, keysecondary);

  const normalizedPosition = resolvePosition(position);
  if (!normalizedPosition && position !== undefined) {
    normalizedExtensions.position = position as unknown;
  }

  let normalizedSelective: boolean | undefined;
  if (typeof selective === "boolean") {
    // If selective is true but there are no valid secondary keys, treat as false
    normalizedSelective = selective && resolvedSecondary.length > 0;
  }

  return {
    keys: resolvedKeys,
    content: typeof content === "string" ? content : "",
    extensions: normalizedExtensions,
    enabled: typeof enabled === "boolean" ? enabled : !(disable === true),
    insertion_order:
      typeof insertion_order === "number"
        ? insertion_order
        : typeof order === "number"
          ? order
          : index,
    case_sensitive: typeof case_sensitive === "boolean" ? case_sensitive : undefined,
    name: typeof name === "string" && name.length > 0 ? name : undefined,
    priority: typeof priority === "number" ? priority : undefined,
    id: typeof id === "number" || typeof id === "string" ? id : createId(),
    comment: typeof comment === "string" ? comment : undefined,
    selective: normalizedSelective,
    secondary_keys: resolvedSecondary.length > 0 ? resolvedSecondary : undefined,
    constant: typeof constant === "boolean" ? constant : undefined,
    position: normalizedPosition,
    use_regex: typeof use_regex === "boolean" ? use_regex : undefined,
  };
}

function mergeStringArrays(...candidates: unknown[]): string[] {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const normalized = candidate
        .map((item) => (typeof item === "string" ? item : String(item)))
        .filter((value) => value.length > 0);
      if (normalized.length > 0) return normalized;
    }
  }
  return [];
}

function resolvePosition(value: unknown): "before_char" | "after_char" | undefined {
  if (value === "before_char" || value === "after_char") {
    return value;
  }
  // TODO: maybe support other positions
  return "after_char";
}

function deriveNameFromFilename(filename?: string) {
  if (!filename) return "Unnamed Lorebook";
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  const cleaned = withoutExt.replace(/[-_]+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : "Unnamed Lorebook";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorldInfoLorebook(value: Record<string, unknown>): Record<string, unknown> | undefined {
  if ("entries" in value && typeof value.entries === "object" && value.entries !== null) {
    return value;
  }
  return undefined;
}
