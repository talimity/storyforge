import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { findUpSync } from "find-up";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = findUpSync(".env", { cwd: __dirname });
if (envPath) {
  loadEnv({ path: envPath, quiet: true });
}

export interface Config {
  server: {
    port: number;
    host: string;
  };
  database: {
    path: string;
  };
  logging: {
    level: string;
    pretty: boolean;
  };
}

function validateConfig(): Config {
  return {
    server: {
      port: Number.parseInt(process.env.PORT || "3001", 10),
      host: process.env.HOST || "localhost",
    },
    database: {
      path: process.env.DATABASE_PATH || "./data/storyforge.db",
    },
    logging: {
      level: process.env.LOG_LEVEL || "info",
      pretty: process.env.NODE_ENV !== "production",
    },
  };
}

export const config = validateConfig();
