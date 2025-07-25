import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log("🔄 Running database migrations...");

  try {
    migrate(db, { migrationsFolder: path.join(__dirname, "migrations") });

    console.log("✅ Migrations completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
