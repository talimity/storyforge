import { sql } from "drizzle-orm";

export const scenarioCharaSummaryColumns = {
  columns: {
    id: true,
    name: true,
    createdAt: true,
    updatedAt: true,
    cardType: true,
    tags: true,
    creatorNotes: true,
  },
  extras: { hasPortrait: sql<number>`portrait IS NOT NULL` },
} as const;
