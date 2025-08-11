import { defineConfig } from "drizzle-kit";
import { createDatabaseConfig } from "./src/config";

// does not work
const dbConfig = createDatabaseConfig();

export default defineConfig({
  schema: "./src/schema/*",
  out: "./src/migrations",
  dialect: "sqlite",
  dbCredentials: { url: dbConfig.path },
  verbose: true,
  strict: true,
});
