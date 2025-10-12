import { DefaultBudgetManager } from "@storyforge/prompt-rendering";
import type {
  ActivatedLoreEntryContract,
  ActivatedLoreIndexContract,
  LorebookData,
  LorebookEntry,
  LorebookEntryEvaluationTraceContract,
  LorebookEvaluationTraceContract,
} from "./schema.js";

const DEFAULT_MAX_RECURSION_ROUNDS = 4;

export type NormalizedLorebookPosition = "before_char" | "after_char";

export type LorebookAssignment = {
  lorebookId: string;
  kind: "manual" | "character";
  enabled: boolean;
  defaultEnabled: boolean;
  characterId: string | null;
  characterLorebookId: string | null;
  data: LorebookData;
};

export type ActivatedLoreEntry = ActivatedLoreEntryContract;
export type ActivatedLoreIndex = ActivatedLoreIndexContract;
export type EntryEvaluationTrace = LorebookEntryEvaluationTraceContract;
export type LorebookEvaluationTrace = LorebookEvaluationTraceContract;

export type ScanLorebooksOptions = {
  maxRecursionRounds?: number;
  crossLorebookRecursion?: boolean;
  extraSegments?: readonly string[];
};

export type ScanLorebooksArgs = {
  turns: ReadonlyArray<{ content: string; isGhost?: boolean }>;
  lorebooks: readonly LorebookAssignment[];
  options?: ScanLorebooksOptions;
};

export type ScanLorebooksDebugResult = {
  result: ActivatedLoreIndex;
  trace: LorebookEvaluationTrace[];
};

type CandidateRecord = {
  entry: LorebookEntry;
  matchKind: EntryMatchKind;
  matchedKeys: string[];
  matchedSecondaryKeys: string[];
};

type EvaluationState = {
  matchedKeys: string[];
  matchedSecondaryKeys: string[];
  matchKind: EntryMatchKind;
  errors: string[];
};

type EvaluateLorebookResult = {
  activatedEntries: ActivatedLoreEntry[];
  trace: LorebookEvaluationTrace;
  activationContentsForSharing: string[];
};

type Corpus = {
  segments: string[];
  segmentsLower: string[];
};

type EntryMatchKind = "constant" | "text" | "regex" | "none";

type SelectionResult = {
  activatedEntries: ActivatedLoreEntry[];
  selectedIds: Set<string | number>;
  skippedByBudget: Set<string | number>;
};

type PhraseMatchResult = {
  matched: string[];
  errors: string[];
  kind: EntryMatchKind;
};

type PhraseEvaluation = {
  matched: string[];
  errors: string[];
};

type ScanResult = {
  result: ActivatedLoreIndex;
  trace: LorebookEvaluationTrace[];
};

export function scanLorebooks(args: ScanLorebooksArgs): ActivatedLoreIndex {
  const { result } = executeScan(args);
  return result;
}

export function scanLorebooksDebug(args: ScanLorebooksArgs): ScanLorebooksDebugResult {
  return executeScan(args);
}

function executeScan(args: ScanLorebooksArgs): ScanResult {
  const assignments = [...args.lorebooks];

  const index: ActivatedLoreIndex = { before_char: [], after_char: [] };
  const trace: LorebookEvaluationTrace[] = [];
  const sharedActivationSegments: string[] = [];

  for (const assignment of assignments) {
    const evaluation = evaluateLorebook(
      assignment,
      args.turns,
      args.options,
      sharedActivationSegments
    );

    for (const entry of evaluation.activatedEntries) {
      index[entry.position].push(entry);
    }

    if (assignment.data.recursive_scanning && args.options?.crossLorebookRecursion) {
      sharedActivationSegments.push(...evaluation.activationContentsForSharing);
    }

    trace.push(evaluation.trace);
  }

  return { result: index, trace };
}

function evaluateLorebook(
  assignment: LorebookAssignment,
  turns: ReadonlyArray<{ content: string; isGhost?: boolean }>,
  options: ScanLorebooksOptions | undefined,
  sharedActivationSegments: readonly string[]
): EvaluateLorebookResult {
  const data = assignment.data;
  const entries = [...data.entries].sort(
    (left, right) => left.insertion_order - right.insertion_order
  );

  if (!assignment.enabled) {
    const trace = buildDisabledLorebookTrace(assignment.lorebookId, entries);
    return {
      activatedEntries: [],
      trace,
      activationContentsForSharing: [],
    };
  }

  const baseSegments = collectSegments(turns, data.scan_depth, options?.extraSegments);
  const corpus: Corpus = {
    segments: baseSegments.slice(),
    segmentsLower: baseSegments.map(lowerSegment),
  };

  if (data.recursive_scanning && options?.crossLorebookRecursion) {
    for (const segment of sharedActivationSegments) {
      addSegment(corpus, segment);
    }
  }

  const evaluationStates = new Map<string | number, EvaluationState>();
  const matchedRecords = new Map<string | number, CandidateRecord>();
  const activationContentsForSharing: string[] = [];

  const maxRounds = resolveMaxRounds(options?.maxRecursionRounds);

  for (let round = 0; round < maxRounds; round += 1) {
    let activatedThisRound = false;

    for (const entry of entries) {
      const evaluation = evaluateEntry(entry, corpus);
      evaluationStates.set(entry.id, evaluation);

      if (!evaluation.matchKind || evaluation.matchKind === "none") {
        continue;
      }

      if (entry.constant === true) {
        recordMatch(
          entry,
          evaluation,
          matchedRecords,
          activationContentsForSharing,
          corpus,
          data.recursive_scanning
        );
        activatedThisRound = true;
        continue;
      }

      const primaryMatched = evaluation.matchedKeys.length > 0;
      if (!primaryMatched) {
        continue;
      }

      const secondaryRequirement = entry.selective === true;
      const secondaryMatched = evaluation.matchedSecondaryKeys.length > 0 || !secondaryRequirement;
      if (!secondaryMatched) {
        continue;
      }

      if (matchedRecords.has(entry.id)) {
        continue;
      }

      recordMatch(
        entry,
        evaluation,
        matchedRecords,
        activationContentsForSharing,
        corpus,
        data.recursive_scanning
      );
      activatedThisRound = true;
    }

    if (!data.recursive_scanning || !activatedThisRound) {
      break;
    }
  }

  const selected = selectEntries(assignment, matchedRecords);
  const trace = buildTrace(assignment.lorebookId, entries, selected, evaluationStates);

  return {
    activatedEntries: selected.activatedEntries,
    trace,
    activationContentsForSharing,
  };
}

function buildDisabledLorebookTrace(
  lorebookId: string,
  entries: readonly LorebookEntry[]
): LorebookEvaluationTrace {
  const traces: EntryEvaluationTrace[] = entries.map((entry) => ({
    entryId: entry.id,
    activated: false,
    matchedKeys: [],
    matchedSecondaryKeys: [],
    matchKind: "none",
    skippedByBudget: false,
    errors: [],
  }));

  return { lorebookId, entries: traces };
}

function resolveMaxRounds(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_MAX_RECURSION_ROUNDS;
  }
  if (Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return 1;
}

function collectSegments(
  turns: ReadonlyArray<{ content: string; isGhost?: boolean }>,
  scanDepth: number | undefined,
  extraSegments: readonly string[] | undefined
): string[] {
  const result: string[] = [];
  const relevantTurns = sliceTurnsByDepth(turns, scanDepth);
  for (const turn of relevantTurns) {
    if (turn.isGhost === true) {
      continue;
    }
    if (!turn.content) {
      continue;
    }
    result.push(turn.content);
  }

  if (extraSegments) {
    for (const segment of extraSegments) {
      if (segment) {
        result.push(segment);
      }
    }
  }

  return result;
}

function sliceTurnsByDepth(
  turns: ReadonlyArray<{ content: string; isGhost?: boolean }>,
  scanDepth: number | undefined
): ReadonlyArray<{ content: string; isGhost?: boolean }> {
  if (scanDepth === undefined) {
    return turns;
  }
  if (!Number.isFinite(scanDepth) || scanDepth <= 0) {
    return [];
  }
  const depth = Math.floor(scanDepth);
  const start = Math.max(turns.length - depth, 0);
  return turns.slice(start);
}

function addSegment(corpus: Corpus, text: string): void {
  if (!text) {
    return;
  }
  corpus.segments.push(text);
  corpus.segmentsLower.push(lowerSegment(text));
}

function lowerSegment(value: string): string {
  return value.toLocaleLowerCase();
}

function evaluateEntry(entry: LorebookEntry, corpus: Corpus): EvaluationState {
  if (!entry.enabled) {
    return createEmptyEvaluationState();
  }

  if (entry.constant === true) {
    return {
      matchKind: "constant",
      matchedKeys: [],
      matchedSecondaryKeys: [],
      errors: [],
    };
  }

  const primary = matchPhrases(
    entry.keys,
    corpus,
    entry.use_regex === true,
    entry.case_sensitive === true
  );
  const secondaryKeys = entry.secondary_keys ?? [];
  const secondary =
    secondaryKeys.length > 0
      ? matchPhrases(secondaryKeys, corpus, entry.use_regex === true, entry.case_sensitive === true)
      : { matched: [], errors: [] };

  return {
    matchKind: primary.kind,
    matchedKeys: primary.matched,
    matchedSecondaryKeys: secondary.matched,
    errors: [...primary.errors, ...secondary.errors],
  };
}

function matchPhrases(
  phrases: readonly string[],
  corpus: Corpus,
  useRegex: boolean,
  caseSensitive: boolean
): PhraseMatchResult {
  if (phrases.length === 0) {
    return { matched: [], errors: [], kind: "none" };
  }

  if (useRegex) {
    const matches = matchRegexPhrases(phrases, corpus.segments, caseSensitive);
    return {
      matched: matches.matched,
      errors: matches.errors,
      kind: matches.matched.length > 0 ? "regex" : "none",
    };
  }

  const matches = matchPlainPhrases(phrases, corpus, caseSensitive);
  return {
    matched: matches.matched,
    errors: matches.errors,
    kind: matches.matched.length > 0 ? "text" : "none",
  };
}

function matchRegexPhrases(
  phrases: readonly string[],
  segments: readonly string[],
  caseSensitive: boolean
): PhraseEvaluation {
  const matched: string[] = [];
  const errors: string[] = [];

  for (const phrase of phrases) {
    try {
      const flags = caseSensitive ? "" : "i";
      const regex = new RegExp(phrase, flags);
      const hasMatch = segments.some((segment) => regex.test(segment));
      if (hasMatch) {
        matched.push(phrase);
      }
    } catch (error) {
      errors.push(String(error));
    }
  }

  return { matched, errors };
}

function matchPlainPhrases(
  phrases: readonly string[],
  corpus: Corpus,
  caseSensitive: boolean
): PhraseEvaluation {
  const matched: string[] = [];
  const errors: string[] = [];

  if (caseSensitive) {
    for (const phrase of phrases) {
      const hasMatch = corpus.segments.some((segment) => segment.includes(phrase));
      if (hasMatch) {
        matched.push(phrase);
      }
    }
    return { matched, errors };
  }

  for (const phrase of phrases) {
    const loweredPhrase = phrase.toLocaleLowerCase();
    const hasMatch = corpus.segmentsLower.some((segment) => segment.includes(loweredPhrase));
    if (hasMatch) {
      matched.push(phrase);
    }
  }

  return { matched, errors };
}

function recordMatch(
  entry: LorebookEntry,
  evaluation: EvaluationState,
  matchedRecords: Map<string | number, CandidateRecord>,
  activationContentsForSharing: string[],
  corpus: Corpus,
  recursive: boolean | undefined
): void {
  if (matchedRecords.has(entry.id)) {
    return;
  }

  matchedRecords.set(entry.id, {
    entry,
    matchKind: evaluation.matchKind,
    matchedKeys: evaluation.matchedKeys,
    matchedSecondaryKeys: evaluation.matchedSecondaryKeys,
  });

  if (!recursive) {
    return;
  }

  addSegment(corpus, entry.content);
  activationContentsForSharing.push(entry.content);
}

function selectEntries(
  assignment: LorebookAssignment,
  matchedRecords: Map<string | number, CandidateRecord>
): SelectionResult {
  const budgetManager = new DefaultBudgetManager({ maxTokens: assignment.data.token_budget });
  const selectedRecords: CandidateRecord[] = [];
  const selectedIds = new Set<string | number>();
  const skippedByBudget = new Set<string | number>();

  const candidates = [...matchedRecords.values()].sort(candidateComparator);
  for (const candidate of candidates) {
    const canFit = budgetManager.canFitTokenEstimate(candidate.entry.content);
    if (!canFit) {
      skippedByBudget.add(candidate.entry.id);
      continue;
    }

    budgetManager.consume(candidate.entry.content);
    selectedRecords.push(candidate);
    selectedIds.add(candidate.entry.id);
  }

  const activatedEntries = selectedRecords
    .sort((left, right) => {
      if (left.entry.insertion_order !== right.entry.insertion_order) {
        return left.entry.insertion_order - right.entry.insertion_order;
      }
      const leftName = left.entry.name ?? "";
      const rightName = right.entry.name ?? "";
      if (leftName !== rightName) {
        return leftName.localeCompare(rightName);
      }
      return String(left.entry.id).localeCompare(String(right.entry.id));
    })
    .map<ActivatedLoreEntry>((record) => ({
      lorebookId: assignment.lorebookId,
      entryId: record.entry.id,
      content: record.entry.content,
      position: normalizePosition(record.entry.position),
      name: record.entry.name,
      comment: record.entry.comment,
    }));

  return { activatedEntries, selectedIds, skippedByBudget };
}

function candidateComparator(left: CandidateRecord, right: CandidateRecord): number {
  const leftPriority = left.entry.priority ?? 0;
  const rightPriority = right.entry.priority ?? 0;
  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }

  if (left.entry.insertion_order !== right.entry.insertion_order) {
    return left.entry.insertion_order - right.entry.insertion_order;
  }

  const leftName = left.entry.name ?? "";
  const rightName = right.entry.name ?? "";
  if (leftName !== rightName) {
    return leftName.localeCompare(rightName);
  }

  const leftId = String(left.entry.id);
  const rightId = String(right.entry.id);
  return leftId.localeCompare(rightId);
}

function normalizePosition(position: unknown): NormalizedLorebookPosition {
  if (position === "after_char") {
    return "after_char";
  }
  return "before_char";
}

function buildTrace(
  lorebookId: string,
  entries: readonly LorebookEntry[],
  selection: SelectionResult,
  evaluationStates: Map<string | number, EvaluationState>
): LorebookEvaluationTrace {
  const traces: EntryEvaluationTrace[] = [];

  for (const entry of entries) {
    const state = evaluationStates.get(entry.id) ?? createEmptyEvaluationState();

    const activated = selection.selectedIds.has(entry.id);
    const skipped = selection.skippedByBudget.has(entry.id);

    traces.push({
      entryId: entry.id,
      activated,
      matchedKeys: state.matchedKeys.slice(),
      matchedSecondaryKeys: state.matchedSecondaryKeys.slice(),
      matchKind: state.matchKind,
      skippedByBudget: skipped,
      errors: state.errors.slice(),
    });
  }

  return { lorebookId, entries: traces };
}

function createEmptyEvaluationState(): EvaluationState {
  return {
    matchKind: "none",
    matchedKeys: [],
    matchedSecondaryKeys: [],
    errors: [],
  };
}
