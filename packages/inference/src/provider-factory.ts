import type { ProviderAdapter, ProviderAuth } from "./providers/base";
import { DeepSeekAdapter } from "./providers/deepseek";
import { OpenAICompatibleAdapter } from "./providers/openai-compatible";
import { OpenRouterAdapter } from "./providers/openrouter";
import type { TextInferenceCapabilities } from "./types";

export interface ProviderConfig {
  kind: "openrouter" | "deepseek" | "openai-compatible";
  auth: ProviderAuth;
  baseUrl?: string;
  capabilities?: Partial<TextInferenceCapabilities>;
}

export function createAdapter(config: ProviderConfig): ProviderAdapter {
  switch (config.kind) {
    case "openrouter":
      return new OpenRouterAdapter(config.auth);

    case "deepseek":
      return new DeepSeekAdapter(config.auth);

    case "openai-compatible":
      if (!config.baseUrl) {
        throw new Error("Base URL is required for OpenAI-compatible provider");
      }
      return new OpenAICompatibleAdapter(
        config.auth,
        config.baseUrl,
        config.capabilities
      );

    default:
      throw new Error(`Unknown provider kind: ${config.kind}`);
  }
}

export function getDefaultCapabilities(
  kind: string
): TextInferenceCapabilities {
  switch (kind) {
    case "openrouter":
      return new OpenRouterAdapter({ apiKey: "" }).defaultCapabilities();

    case "deepseek":
      return new DeepSeekAdapter({ apiKey: "" }).defaultCapabilities();

    case "openai-compatible":
      // Return conservative defaults for generic OpenAI-compatible
      return {
        streaming: true,
        assistantPrefill: false,
        logprobs: false,
        tools: false,
        fim: false,
      };

    default:
      throw new Error(`Unknown provider kind: ${kind}`);
  }
}
