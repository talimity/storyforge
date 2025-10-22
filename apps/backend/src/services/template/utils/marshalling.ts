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
import { ServiceError } from "../../../service-error.js";

/**
 * Given an unknown database prompt template, parse and validate it into a
 * strongly typed PromptTemplate.
 */
export function fromDbPromptTemplate(template: DbTemplate, lint = true) {
  const json = {
    id: template.id,
    task: template.kind,
    name: template.name,
    description: template.description ?? undefined,
    version: template.version,
    layout: template.layout,
    slots: template.slots,
  };

  switch (template.kind) {
    case "turn_generation":
      return parseTemplate<"turn_generation", TurnGenSources>(
        json,
        "turn_generation",
        lint ? TURN_GEN_SOURCE_NAMES : undefined
      );
    case "chapter_summarization":
      return parseTemplate<"chapter_summarization", ChapterSummSources>(
        json,
        "chapter_summarization",
        lint ? CHAPTER_SUMM_SOURCE_NAMES : undefined
      );
    case "writing_assistant":
      return parseTemplate<"writing_assistant", WritingAssistantSources>(
        json,
        "writing_assistant",
        lint ? WRITING_ASSIST_SOURCE_NAMES : undefined
      );
    default:
      throw new ServiceError("InvalidInput", {
        message: `Unknown prompt template kind: ${template.kind}`,
      });
  }
}

export function tryCompileUnboundTemplate(template: UnboundTemplate) {
  let ctx: {
    task: "turn_generation" | "chapter_summarization" | "writing_assistant";
    sources: readonly string[];
  };
  switch (template.task) {
    case "turn_generation":
      ctx = {
        task: "turn_generation" as const,
        sources: TURN_GEN_SOURCE_NAMES,
      };
      break;
    case "chapter_summarization":
      ctx = {
        task: "chapter_summarization" as const,
        sources: CHAPTER_SUMM_SOURCE_NAMES,
      };
      break;
    case "writing_assistant":
      ctx = {
        task: "writing_assistant" as const,
        sources: WRITING_ASSIST_SOURCE_NAMES,
      };
      break;
    default:
      throw new ServiceError("InvalidInput", {
        message: `Unknown prompt template kind: ${template.task}`,
      });
  }

  try {
    compileTemplate(template, { allowedSources: ctx.sources, kind: ctx.task });
  } catch (error) {
    throw new ServiceError("InvalidInput", {
      message: `Template validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
