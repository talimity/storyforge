import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log("🔄 Running database migrations...");

  try {
    migrate(db, { migrationsFolder: path.join(__dirname, "migrations") });

    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed", error);
    throw error;
  }
}

// If this file is run directly, execute migrations
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
