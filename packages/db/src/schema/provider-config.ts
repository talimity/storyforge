import { createId } from "@storyforge/utils";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const providerConfigs = sqliteTable("provider_configs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  kind: text("kind")
    .notNull()
    .$type<"openrouter" | "deepseek" | "openai-compatible">(),
  name: text("name").notNull(),
  auth: text("auth", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull(),
  baseUrl: text("base_url"),

  // TODO: support openai-compatible providers, which will each have different
  // capabilities and generation parameter mappings that cannot be hardcoded in
  // an implementation.

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type ProviderConfig = typeof providerConfigs.$inferSelect;
export type NewProviderConfig = typeof providerConfigs.$inferInsert;
