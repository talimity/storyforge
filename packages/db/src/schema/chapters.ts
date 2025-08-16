import { createId } from "@paralleldrive/cuid2";
import {
  type AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";
import { scenarios } from "./scenarios";
import { turns } from "./turns";

export const chapters = sqliteTable(
  "chapters",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    index: integer("index").notNull().default(0),
    firstTurnId: text("first_turn_id").references(
      (): AnySQLiteColumn => turns.id,
      { onDelete: "restrict" }
    ),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique().on(t.scenarioId, t.index)]
);

export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;
