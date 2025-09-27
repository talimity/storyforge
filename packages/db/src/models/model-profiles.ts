import { createId } from "@storyforge/utils";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { providerConfigs } from "./provider-config.js";

export const modelProfiles = sqliteTable("model_profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  providerId: text("provider_id")
    .notNull()
    .references(() => providerConfigs.id, { onDelete: "cascade" }),
  displayName: text("name").notNull(),
  // This is the model ID as used by the provider, e.g. "deepseek/deepseek-r1-0528"
  modelId: text("model_id").notNull(),
  // Per-model capability overrides (JSON)
  capabilityOverrides: text("capability_overrides", { mode: "json" }).$type<
    Record<string, unknown>
  >(),
  textTemplate: text("text_template"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type ModelProfile = typeof modelProfiles.$inferSelect;
export type NewModelProfile = typeof modelProfiles.$inferInsert;
