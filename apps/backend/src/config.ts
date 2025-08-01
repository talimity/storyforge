import "dotenv/config";

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
    defaultProvider: "openrouter" | "deepseek" | "openai";
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
  const defaultProvider = (process.env.DEFAULT_LLM_PROVIDER ||
    "openrouter") as Config["llm"]["defaultProvider"];

  if (!openrouterApiKey && !deepseekApiKey && !openaiApiKey) {
    throw new Error("At least one LLM provider API key must be configured");
  }

  const supportedProviders = ["openrouter", "deepseek", "openai"] as const;
  if (!supportedProviders.includes(defaultProvider)) {
    throw new Error(
      `DEFAULT_LLM_PROVIDER must be one of: ${supportedProviders.join(", ")}`
    );
  }

  if (defaultProvider === "openrouter" && !openrouterApiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is required when DEFAULT_LLM_PROVIDER is openrouter"
    );
  }
  if (defaultProvider === "deepseek" && !deepseekApiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY is required when DEFAULT_LLM_PROVIDER is deepseek"
    );
  }
  if (defaultProvider === "openai" && !openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is required when DEFAULT_LLM_PROVIDER is openai"
    );
  }

  return {
    llm: {
      ...(openrouterApiKey && { openrouter: { apiKey: openrouterApiKey } }),
      ...(deepseekApiKey && { deepseek: { apiKey: deepseekApiKey } }),
      ...(openaiApiKey && { openai: { apiKey: openaiApiKey } }),
      defaultProvider,
    },
    server: {
      port: parseInt(process.env.PORT || "3001", 10),
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
