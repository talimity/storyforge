import {
  type ChapterSummary as ChapterSummaryRow,
  chapterSummaries,
  type SqliteTxLike,
} from "@storyforge/db";
import type { ChapterSummaryContext } from "@storyforge/gentasks";
import { TimelineStateDeriver } from "@storyforge/timeline-events";
import { normalizeJson } from "@storyforge/utils";
import { inArray } from "drizzle-orm";
import { TimelineEventLoader } from "../timeline-events/loader.js";
import type { ChapterEntry, ChapterNode } from "./types.js";

export async function getSummariesForPath(
  db: SqliteTxLike,
  args: { scenarioId: string; leafTurnId?: string | null }
): Promise<ChapterSummaryContext[]> {
  const nodes = await loadChapterNodes(db, args);
  const closingIds = nodes
    .map((node) => node.closing?.eventId)
    .filter((id): id is string => Boolean(id));

  if (closingIds.length === 0) return [];

  const rows = await db
    .select()
    .from(chapterSummaries)
    .where(inArray(chapterSummaries.closingEventId, closingIds));

  const rowsByClosing = new Map(rows.map((row) => [row.closingEventId, row]));

  const entries: ChapterSummaryContext[] = [];
  for (const node of nodes) {
    const closing = node.closing;
    if (!closing) continue;
    const row = rowsByClosing.get(closing.eventId);
    if (!row) continue;
    entries.push(toCtxEntry(row, node.chapter));
  }

  entries.sort((a, b) => a.chapterNumber - b.chapterNumber);
  return entries;
}

export async function loadChapterNodes(
  db: SqliteTxLike,
  args: { scenarioId: string; leafTurnId?: string | null }
) {
  const entries = await loadChapterEntries(db, args);
  const nodes: ChapterNode[] = [];
  for (let idx = 0; idx < entries.length; idx += 1) {
    nodes.push({
      chapter: entries[idx],
      closing: entries[idx + 1] ?? null,
    });
  }
  return nodes;
}

export async function loadChapterEntries(
  db: SqliteTxLike,
  args: { scenarioId: string; leafTurnId?: string | null }
): Promise<ChapterEntry[]> {
  const loader = new TimelineEventLoader(db);
  const deriver = new TimelineStateDeriver(loader);
  const derivation = await deriver.run({ ...args, mode: { mode: "events" } });

  const chapters = derivation.final.chapters?.chapters ?? [];
  return chapters.map((entry) => ({
    eventId: entry.eventId,
    turnId: entry.turnId,
    chapterNumber: entry.number,
    title: entry.title,
  }));
}

export async function loadPreviousSummariesForContext(
  db: SqliteTxLike,
  args: { scenarioId: string; closingEventId: string }
): Promise<ChapterSummaryContext[]> {
  const nodes = await loadChapterNodes(db, args);
  const previousNodes = [];
  for (const node of nodes) {
    if (node.closing?.eventId === args.closingEventId) break;
    if (node.closing) previousNodes.push(node);
  }

  if (previousNodes.length === 0) return [];

  const closingIds = previousNodes
    .map((node) => node.closing?.eventId)
    .filter((id): id is string => Boolean(id));
  if (closingIds.length === 0) return [];

  const rows = await db
    .select()
    .from(chapterSummaries)
    .where(inArray(chapterSummaries.closingEventId, closingIds));

  const rowsByClosing = new Map(rows.map((row) => [row.closingEventId, row]));

  return previousNodes
    .map((node) => {
      const closing = node.closing;
      if (!closing) return null;

      const row = rowsByClosing.get(closing.eventId);
      if (!row) return null;
      return toCtxEntry(row, node.chapter);
    })
    .filter((entry): entry is ChapterSummaryContext => Boolean(entry));
}

function toCtxEntry(record: ChapterSummaryRow, chapter: ChapterEntry): ChapterSummaryContext {
  return {
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    summaryText: record.summaryText,
    summaryJson: normalizeJson(record.summaryJson),
    updatedAt: record.updatedAt,
  };
}
