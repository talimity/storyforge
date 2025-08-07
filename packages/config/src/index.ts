import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { findUpSync } from "find-up";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = findUpSync(".env", { cwd: __dirname });
if (envPath) {
  loadEnv({ path: envPath });
}

export interface Config {
  llm: {
    openrouter?: {
      apiKey: string;
    };
    deepseek?: {
      apiKey: string;
    };
    openai?: {
      apiKey: string;
    };
  };
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
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  return {
    llm: {
      ...(openrouterApiKey && { openrouter: { apiKey: openrouterApiKey } }),
      ...(deepseekApiKey && { deepseek: { apiKey: deepseekApiKey } }),
      ...(openaiApiKey && { openai: { apiKey: openaiApiKey } }),
    },
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
