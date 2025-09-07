import { mkdirSync } from "node:fs";
import path from "node:path";
import { config } from "@storyforge/config";

export interface DatabaseConfig {
  path: string;
}

export function createDatabaseConfig(overrides?: Partial<DatabaseConfig>): DatabaseConfig {
  const dbConfig = { path: config.database.path, ...overrides };

  assertIsDatabaseConfig(dbConfig);

  if (!path.isAbsolute(dbConfig.path)) {
    dbConfig.path = path.resolve(process.cwd(), "..", "..", dbConfig.path);
  }

  console.log("Using database at path:", dbConfig.path);
  mkdirSync(path.dirname(dbConfig.path), { recursive: true });

  return dbConfig;
}

function assertIsDatabaseConfig(config: Partial<DatabaseConfig>): asserts config is DatabaseConfig {
  if (!config.path) {
    throw new Error("No database path provided.");
  }
}
