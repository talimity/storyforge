import type { ProviderAdapter } from "./providers/base";

import { DeepseekAdapter } from "./providers/deepseek";
import { MockAdapter } from "./providers/mock";
import { OpenAICompatibleAdapter } from "./providers/openai-compatible";
import { OpenRouterAdapter } from "./providers/openrouter";
import type { ProviderConfig, TextInferenceCapabilities } from "./types";

export function createAdapter(config: ProviderConfig): ProviderAdapter {
  switch (config.kind) {
    case "deepseek":
      return new DeepseekAdapter(config.auth, config.baseUrl);

    case "openrouter":
      return new OpenRouterAdapter(config.auth);

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
