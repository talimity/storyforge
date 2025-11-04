import type { AttachmentLaneSpec, RenderOptions } from "@storyforge/prompt-rendering";
import { buildChapterSeparatorRenderOptions } from "../../attachments/chapter-separators.js";
import { buildLoreRenderOptions } from "../../attachments/lore.js";
import type { NarrativeContext } from "./context.js";

type NarrativeRenderOptionsExtras = {
  extraSegments?: readonly string[];
};

/**
 * Produces prompt render options for narrative tasks by combining lore attachments, chapter
 * separators, and any optional extras supplied by the caller. Consumers can merge the returned
 * defaults with workflow-specific additions before invoking the prompt renderer.
 */
export function buildNarrativeRenderOptions<Ctx extends NarrativeContext>(
  ctx: Ctx,
  extras?: NarrativeRenderOptionsExtras
): RenderOptions {
  const lore = buildLoreRenderOptions({
    turns: ctx.turns,
    lorebooks: ctx.lorebooks,
    extraSegments: extras?.extraSegments,
  });

  const chapters = buildChapterSeparatorRenderOptions({
    turns: ctx.turns,
    chapterSummaries: ctx.chapterSummaries,
    chapters: ctx.chapters,
  });

  const attachmentDefaults = mergeLaneSpecs(lore.attachmentDefaults, chapters.attachmentDefaults);
  const injections = [...(chapters.injections ?? []), ...(lore.injections ?? [])];

  return {
    ...(attachmentDefaults.length > 0 ? { attachmentDefaults } : {}),
    ...(injections.length > 0 ? { injections } : {}),
  };
}

function mergeLaneSpecs(
  ...collections: Array<readonly AttachmentLaneSpec[] | undefined>
): AttachmentLaneSpec[] {
  const ordered: AttachmentLaneSpec[] = [];
  const seen = new Set<string>();

  for (const collection of collections) {
    if (!collection) continue;
    for (const spec of collection) {
      if (seen.has(spec.id)) continue;
      seen.add(spec.id);
      ordered.push(spec);
    }
  }

  return ordered;
}
