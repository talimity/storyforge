import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { SqliteDatabase } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findMigrationsFolder(): string {
  // Try multiple possible locations
  const possiblePaths = [
    path.join(__dirname, "migrations"), // Same directory
    path.join(__dirname, "..", "src", "migrations"), // From dist to src
    path.join(__dirname, "..", "..", "src", "migrations"), // Extra level up
    path.join(process.cwd(), "packages", "db", "src", "migrations"), // From monorepo root
  ];

  for (const p of possiblePaths) {
    if (existsSync(path.join(p, "meta", "_journal.json"))) {
      return p;
    }
  }

  throw new Error(`Could not find migrations folder. Tried: ${possiblePaths.join(", ")}`);
}

export async function runMigrations(db: SqliteDatabase) {
  try {
    const migrationsFolder = findMigrationsFolder();
    await migrate(db, { migrationsFolder });
  } catch (error) {
    console.error("❌ Migration failed", error);
    throw error;
  }
}
// If this file is run directly, execute migrations
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Running migrations...");
  runMigrations(await import("./client.js").then((m) => m.getDbClient()))
    .then(() => {
      console.log("✅ Migrations completed successfully");
      return process.exit(0);
    })
    .catch(() => process.exit(1));
}
