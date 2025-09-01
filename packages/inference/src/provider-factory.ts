import type { ProviderAdapter } from "./providers/base.js";

import { DeepseekAdapter } from "./providers/deepseek.js";
import { MockAdapter } from "./providers/mock.js";
import { OpenAICompatibleAdapter } from "./providers/openai-compatible.js";
import { OpenRouterAdapter } from "./providers/openrouter.js";
import type { ProviderConfig, TextInferenceCapabilities } from "./types.js";

export function createAdapter(config: ProviderConfig): ProviderAdapter {
  switch (config.kind) {
    case "deepseek":
      return new DeepseekAdapter(config.auth, config.baseUrl);

    case "openrouter":
      return new OpenRouterAdapter(config.auth, config.baseUrl);

    case "openai-compatible":
      if (!config.baseUrl) {
        throw new Error("Base URL is required for OpenAI-compatible provider");
      }
      return new OpenAICompatibleAdapter(
        config.auth,
        config.baseUrl,
        config.capabilities,
        config.genParams
      );

    case "mock":
      return new MockAdapter(config.auth);

    default:
      throw new Error(`Unknown provider kind: ${config.kind}`);
  }
}

export function getDefaultCapabilities(
  kind: string
): TextInferenceCapabilities {
  switch (kind) {
    case "deepseek":
      return new DeepseekAdapter({ apiKey: "" }).defaultCapabilities();

    case "openrouter":
      return new OpenRouterAdapter({ apiKey: "" }).defaultCapabilities();

    case "openai-compatible":
      // Return conservative defaults for generic OpenAI-compatible
      return {
        streaming: true,
        assistantPrefill: "explicit",
        tools: false,
        fim: false,
      };

    case "mock":
      return new MockAdapter({ apiKey: "" }).defaultCapabilities();

    default:
      throw new Error(`Unknown provider kind: ${kind}`);
  }
}
