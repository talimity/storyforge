import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client";
import { createChildLogger } from "@/logging";
import path from "path";
import { fileURLToPath } from "url";

const logger = createChildLogger("db:migrate");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  logger.info("🔄 Running database migrations...");

  try {
    migrate(db, { migrationsFolder: path.join(__dirname, "migrations") });

    logger.info("✅ Migrations completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error(error, "❌ Migration failed");
    process.exit(1);
  }
}

runMigrations();
