import { buildDefaultLoreLaneSpec, LORE_LANE_ID } from "@storyforge/gentasks";
import type { AttachmentLaneSpec } from "@storyforge/prompt-rendering";
import type { AttachmentWarning, LoreAttachmentFormValues, LoreAttachmentLaneDraft } from "./types";

const BLANK_TEMPLATE = "";

export function getDefaultLoreAttachmentValues(): LoreAttachmentFormValues {
  const defaults = buildDefaultLoreLaneSpec();
  const groups = defaults.groups ?? [];
  const beforeDefaults = groups.find((group) => group.id === "before_char");
  const afterDefaults = groups.find((group) => group.id === "after_char");
  const perTurnDefaults = groups.find((group) => group.match === "^turn_");

  return {
    enabled: defaults.enabled ?? true,
    role: defaults.role ?? "system",
    template: defaults.template ?? BLANK_TEMPLATE,
    groups: {
      beforeCharacters: {
        open: beforeDefaults?.openTemplate ?? BLANK_TEMPLATE,
        close: beforeDefaults?.closeTemplate ?? BLANK_TEMPLATE,
      },
      afterCharacters: {
        open: afterDefaults?.openTemplate ?? BLANK_TEMPLATE,
        close: afterDefaults?.closeTemplate ?? BLANK_TEMPLATE,
      },
      perTurn: {
        open: perTurnDefaults?.openTemplate ?? BLANK_TEMPLATE,
        close: perTurnDefaults?.closeTemplate ?? BLANK_TEMPLATE,
      },
    },
  };
}

export function serializeLoreValues(values: LoreAttachmentFormValues): AttachmentLaneSpec {
  const defaults = buildDefaultLoreLaneSpec();

  const normalize = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length ? trimmed : undefined;
  };

  return {
    ...defaults,
    enabled: values.enabled,
    role: values.role,
    template: normalize(values.template) ?? defaults.template,
    groups: [
      {
        ...(defaults.groups?.find((group) => group.id === "before_char") ?? {}),
        id: "before_char",
        openTemplate: normalize(values.groups.beforeCharacters.open),
        closeTemplate: normalize(values.groups.beforeCharacters.close),
      },
      {
        ...(defaults.groups?.find((group) => group.id === "after_char") ?? {}),
        id: "after_char",
        openTemplate: normalize(values.groups.afterCharacters.open),
        closeTemplate: normalize(values.groups.afterCharacters.close),
      },
      {
        ...(defaults.groups?.find((group) => group.match === "^turn_") ?? {}),
        match: "^turn_",
        openTemplate: normalize(values.groups.perTurn.open),
        closeTemplate: normalize(values.groups.perTurn.close),
      },
    ],
  };
}

export function deserializeLoreSpec(spec?: AttachmentLaneSpec): LoreAttachmentFormValues {
  if (!spec || spec.id !== LORE_LANE_ID) {
    return getDefaultLoreAttachmentValues();
  }

  const groups = spec.groups ?? [];
  const before = groups.find((group) => group.id === "before_char");
  const after = groups.find((group) => group.id === "after_char");
  const perTurn = groups.find((group) => group.match === "^turn_");

  return {
    enabled: spec.enabled ?? true,
    role: spec.role ?? "system",
    template: spec.template ?? BLANK_TEMPLATE,
    groups: {
      beforeCharacters: {
        open: before?.openTemplate ?? BLANK_TEMPLATE,
        close: before?.closeTemplate ?? BLANK_TEMPLATE,
      },
      afterCharacters: {
        open: after?.openTemplate ?? BLANK_TEMPLATE,
        close: after?.closeTemplate ?? BLANK_TEMPLATE,
      },
      perTurn: {
        open: perTurn?.openTemplate ?? BLANK_TEMPLATE,
        close: perTurn?.closeTemplate ?? BLANK_TEMPLATE,
      },
    },
  };
}

export function createLoreAttachmentDraftFromSpec(
  spec?: AttachmentLaneSpec
): LoreAttachmentLaneDraft {
  const values = deserializeLoreSpec(spec);
  const finalSpec = serializeLoreValues(values);
  return {
    laneId: LORE_LANE_ID,
    type: "lore",
    values: cloneLoreAttachmentValues(values),
    spec: finalSpec,
  };
}

export function ensureLoreAttachmentDraft(
  draft?: LoreAttachmentLaneDraft
): LoreAttachmentLaneDraft {
  if (draft) {
    const normalizedValues = cloneLoreAttachmentValues(draft.values);
    const normalizedSpec = serializeLoreValues(normalizedValues);
    return {
      ...draft,
      values: normalizedValues,
      spec: normalizedSpec,
    };
  }
  return createLoreAttachmentDraftFromSpec();
}

export function getLoreAttachmentWarnings(draft: LoreAttachmentLaneDraft): AttachmentWarning[] {
  const warnings: AttachmentWarning[] = [];
  if (!draft.values.enabled) {
    warnings.push({
      code: "lore_disabled",
      level: "warning",
      message:
        "Lore attachment is disabled. Lorebook entries will never be injected when using this prompt.",
    });
  }
  if (!draft.values.template.trim().includes("{{payload.content}}")) {
    warnings.push({
      code: "lore_template_missing_content",
      level: "warning",
      message:
        "Lore entry template is missing {{payload.content}}, so the content of lore entries will not be included.",
    });
  }
  return warnings;
}

export function cloneLoreAttachmentValues(
  values: LoreAttachmentFormValues
): LoreAttachmentFormValues {
  return {
    enabled: values.enabled,
    role: values.role,
    template: values.template,
    groups: {
      beforeCharacters: {
        open: values.groups.beforeCharacters.open,
        close: values.groups.beforeCharacters.close,
      },
      afterCharacters: {
        open: values.groups.afterCharacters.open,
        close: values.groups.afterCharacters.close,
      },
      perTurn: {
        open: values.groups.perTurn.open,
        close: values.groups.perTurn.close,
      },
    },
  };
}
