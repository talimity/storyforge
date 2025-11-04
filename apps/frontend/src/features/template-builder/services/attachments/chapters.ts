import {
  buildDefaultChapterSeparatorLaneSpec,
  CHAPTER_SEPARATOR_LANE_ID,
} from "@storyforge/gentasks";
import type { AttachmentLaneSpec } from "@storyforge/prompt-rendering";
import type {
  AttachmentWarning,
  ChapterSeparatorAttachmentFormValues,
  ChapterSeparatorAttachmentLaneDraft,
} from "@/features/template-builder/services/attachments/types";
import { MESSAGE_ROLE_SELECT_OPTIONS } from "@/features/template-builder/services/builder-utils";

const DEFAULT_TEMPLATE =
  "## Chapter {{payload.chapterNumber}}{{#if payload.title}}: {{payload.title}}{{#endif}}\n";

export function getDefaultChapterSeparatorAttachmentValues(): ChapterSeparatorAttachmentFormValues {
  const defaults = buildDefaultChapterSeparatorLaneSpec();
  return {
    enabled: defaults.enabled ?? true,
    role: defaults.role ?? "system",
    template: defaults.template ?? DEFAULT_TEMPLATE,
  };
}

export function cloneChapterSeparatorAttachmentValues(
  values: ChapterSeparatorAttachmentFormValues
): ChapterSeparatorAttachmentFormValues {
  return {
    enabled: values.enabled,
    role: values.role,
    template: values.template,
  };
}

export function serializeChapterSeparatorValues(
  values: ChapterSeparatorAttachmentFormValues
): AttachmentLaneSpec {
  const defaults = buildDefaultChapterSeparatorLaneSpec();
  return {
    ...defaults,
    enabled: values.enabled,
    role: values.role,
    template: values.template.trim().length ? values.template : defaults.template,
  };
}

export function deserializeChapterSeparatorSpec(
  spec?: AttachmentLaneSpec
): ChapterSeparatorAttachmentFormValues {
  if (!spec || spec.id !== CHAPTER_SEPARATOR_LANE_ID) {
    return getDefaultChapterSeparatorAttachmentValues();
  }

  return {
    enabled: spec.enabled ?? true,
    role: spec.role ?? "system",
    template: spec.template ?? DEFAULT_TEMPLATE,
  };
}

export function createChapterSeparatorAttachmentDraftFromSpec(
  spec?: AttachmentLaneSpec
): ChapterSeparatorAttachmentLaneDraft {
  const values = deserializeChapterSeparatorSpec(spec);
  const serialized = serializeChapterSeparatorValues(values);
  return {
    laneId: CHAPTER_SEPARATOR_LANE_ID,
    type: "chapter_separators",
    values,
    spec: serialized,
  };
}

export function ensureChapterSeparatorAttachmentDraft(
  draft?: ChapterSeparatorAttachmentLaneDraft
): ChapterSeparatorAttachmentLaneDraft {
  if (!draft) {
    return createChapterSeparatorAttachmentDraftFromSpec();
  }

  const values = cloneChapterSeparatorAttachmentValues(draft.values);
  const spec = serializeChapterSeparatorValues(values);
  return {
    ...draft,
    values,
    spec,
  };
}

export function getChapterSeparatorAttachmentWarnings(
  draft: ChapterSeparatorAttachmentLaneDraft
): AttachmentWarning[] {
  const warnings: AttachmentWarning[] = [];
  if (!draft.values.enabled) {
    warnings.push({
      code: "chapter_separators_disabled",
      level: "warning",
      message: "Chapter separators are disabled. Chapter breaks will not be inserted.",
    });
  }

  const normalizedTemplate = draft.values.template.trim().toLowerCase();
  if (!normalizedTemplate.includes("{{payload.chapternumber")) {
    warnings.push({
      code: "chapter_separator_missing_number",
      level: "warning",
      message:
        "Chapter separator template does not reference {{payload.chapterNumber}}. Separators may be ambiguous.",
    });
  }

  return warnings;
}

export function getChapterSeparatorRoleOptions() {
  return MESSAGE_ROLE_SELECT_OPTIONS.slice();
}
