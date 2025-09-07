import { createId } from "@storyforge/utils";
import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const providerConfigs = sqliteTable(
  "provider_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    kind: text("kind").notNull().$type<"openrouter" | "deepseek" | "openai-compatible">(),
    name: text("name").notNull(),
    auth: text("auth", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    baseUrl: text("base_url"),
    capabilities: text("capabilities", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  () => [
    // capabilities should be null for all non-openai-compatible kinds, and
    // should be defined for openai-compatible kind
    check(
      "chk_consistent_capabilities",
      sql`(kind = 'openai-compatible' AND capabilities IS NOT NULL) OR (kind != 'openai-compatible' AND capabilities IS NULL)`
    ),
  ]
);

export type ProviderConfig = typeof providerConfigs.$inferSelect;
export type NewProviderConfig = typeof providerConfigs.$inferInsert;
