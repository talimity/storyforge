import type { PromptTemplate as DbTemplate } from "@storyforge/db";
import {
  CHAPTER_SUMM_SOURCE_NAMES,
  type ChapterSummSources,
  TURN_GEN_SOURCE_NAMES,
  type TurnGenSources,
  WRITING_ASSIST_SOURCE_NAMES,
  type WritingAssistantSources,
} from "@storyforge/gentasks";
import { compileTemplate, parseTemplate, type UnboundTemplate } from "@storyforge/prompt-rendering";
import { stripNulls } from "@storyforge/utils";
import { ServiceError } from "../../../service-error.js";

const TEMPLATE_KIND_CONFIG = {
  turn_generation: {
    task: "turn_generation" as const,
    sources: TURN_GEN_SOURCE_NAMES,
    parse: (json: Parameters<typeof parseTemplate>[0], lint: boolean) =>
      parseTemplate<"turn_generation", TurnGenSources>(
        json,
        "turn_generation",
        lint ? TURN_GEN_SOURCE_NAMES : undefined
      ),
  },
  chapter_summarization: {
    task: "chapter_summarization" as const,
    sources: CHAPTER_SUMM_SOURCE_NAMES,
    parse: (json: Parameters<typeof parseTemplate>[0], lint: boolean) =>
      parseTemplate<"chapter_summarization", ChapterSummSources>(
        json,
        "chapter_summarization",
        lint ? CHAPTER_SUMM_SOURCE_NAMES : undefined
      ),
  },
  writing_assistant: {
    task: "writing_assistant" as const,
    sources: WRITING_ASSIST_SOURCE_NAMES,
    parse: (json: Parameters<typeof parseTemplate>[0], lint: boolean) =>
      parseTemplate<"writing_assistant", WritingAssistantSources>(
        json,
        "writing_assistant",
        lint ? WRITING_ASSIST_SOURCE_NAMES : undefined
      ),
  },
} as const;

type TemplateKind = keyof typeof TEMPLATE_KIND_CONFIG;

function getTemplateConfig(kind: string): (typeof TEMPLATE_KIND_CONFIG)[TemplateKind] {
  const config = TEMPLATE_KIND_CONFIG[kind as TemplateKind];
  if (!config) {
    throw new ServiceError("InvalidInput", {
      message: `Unknown prompt template kind: ${kind}`,
    });
  }
  return config;
}

/**
 * Given an unknown database prompt template, parse and validate it into a
 * strongly typed PromptTemplate.
 */
export function fromDbPromptTemplate(raw: DbTemplate, lint = true) {
  const template = stripNulls(raw);
  const json = {
    id: template.id,
    task: template.kind,
    name: template.name,
    description: template.description,
    version: template.version,
    layout: template.layout,
    slots: template.slots,
    attachments: template.attachments,
  };

  const config = getTemplateConfig(template.kind);
  return config.parse(json, lint);
}

export function tryCompileUnboundTemplate(template: UnboundTemplate) {
  const config = getTemplateConfig(template.task);

  try {
    compileTemplate(template, { allowedSources: config.sources, kind: config.task });
  } catch (error) {
    throw new ServiceError("InvalidInput", {
      message: `Template validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
