import { buildDefaultLoreLaneSpec, LORE_LANE_ID } from "@storyforge/gentasks";
import type { AttachmentLaneSpec } from "@storyforge/prompt-rendering";
import type {
  AttachmentWarning,
  LoreAttachmentFormValues,
  LoreAttachmentGroupFormValues,
  LoreAttachmentLaneDraft,
} from "./types";

const BLANK_TEMPLATE = "";
type AttachmentGroupSpec = NonNullable<AttachmentLaneSpec["groups"]>[number];

export function getDefaultLoreAttachmentValues(): LoreAttachmentFormValues {
  const defaults = buildDefaultLoreLaneSpec();
  const groups = defaults.groups ?? [];
  const beforeDefaults = groups.find((group) => group.id === "before_char");
  const afterDefaults = groups.find((group) => group.id === "after_char");
  const perTurnDefaults = groups.find((group) => group.match === "^turn_");
  const fallbackRole = defaults.role ?? "system";
  const fallbackTemplate = defaults.template ?? BLANK_TEMPLATE;

  const toGroupValues = (
    groupSpec: AttachmentGroupSpec | undefined
  ): LoreAttachmentGroupFormValues => ({
    role: groupSpec?.role ?? fallbackRole,
    template: groupSpec?.template ?? fallbackTemplate,
    open: groupSpec?.openTemplate ?? BLANK_TEMPLATE,
    close: groupSpec?.closeTemplate ?? BLANK_TEMPLATE,
  });

  return {
    enabled: defaults.enabled ?? true,
    groups: {
      beforeCharacters: toGroupValues(beforeDefaults),
      afterCharacters: toGroupValues(afterDefaults),
      perTurn: toGroupValues(perTurnDefaults),
    },
  };
}

export function serializeLoreValues(values: LoreAttachmentFormValues): AttachmentLaneSpec {
  const defaults = buildDefaultLoreLaneSpec();

  const normalize = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length ? trimmed : undefined;
  };

  const normalizeGroup = (group: LoreAttachmentGroupFormValues) => ({
    role: group.role,
    template: normalize(group.template),
    openTemplate: normalize(group.open),
    closeTemplate: normalize(group.close),
  });

  const before = normalizeGroup(values.groups.beforeCharacters);
  const after = normalizeGroup(values.groups.afterCharacters);
  const perTurn = normalizeGroup(values.groups.perTurn);

  return {
    ...defaults,
    enabled: values.enabled,
    groups: [
      {
        ...(defaults.groups?.find((group) => group.id === "before_char") ?? {}),
        id: "before_char",
        role: before.role,
        template: before.template,
        openTemplate: before.openTemplate,
        closeTemplate: before.closeTemplate,
      },
      {
        ...(defaults.groups?.find((group) => group.id === "after_char") ?? {}),
        id: "after_char",
        role: after.role,
        template: after.template,
        openTemplate: after.openTemplate,
        closeTemplate: after.closeTemplate,
      },
      {
        ...(defaults.groups?.find((group) => group.match === "^turn_") ?? {}),
        match: "^turn_",
        role: perTurn.role,
        template: perTurn.template,
        openTemplate: perTurn.openTemplate,
        closeTemplate: perTurn.closeTemplate,
      },
    ],
  };
}

export function deserializeLoreSpec(spec?: AttachmentLaneSpec): LoreAttachmentFormValues {
  if (!spec || spec.id !== LORE_LANE_ID) {
    return getDefaultLoreAttachmentValues();
  }

  const defaults = buildDefaultLoreLaneSpec();
  const groups = spec.groups ?? [];
  const before = groups.find((group) => group.id === "before_char");
  const after = groups.find((group) => group.id === "after_char");
  const perTurn = groups.find((group) => group.match === "^turn_");
  const fallbackRole = spec.role ?? defaults.role ?? "system";
  const fallbackTemplate = spec.template ?? defaults.template ?? BLANK_TEMPLATE;

  const toGroupValues = (
    groupSpec: AttachmentGroupSpec | undefined
  ): LoreAttachmentGroupFormValues => ({
    role: groupSpec?.role ?? fallbackRole,
    template: groupSpec?.template ?? fallbackTemplate,
    open: groupSpec?.openTemplate ?? BLANK_TEMPLATE,
    close: groupSpec?.closeTemplate ?? BLANK_TEMPLATE,
  });

  return {
    enabled: spec.enabled ?? true,
    groups: {
      beforeCharacters: toGroupValues(before),
      afterCharacters: toGroupValues(after),
      perTurn: toGroupValues(perTurn),
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
  const fallbackTemplate = draft.spec.template ?? BLANK_TEMPLATE;
  const checkGroupTemplate = (group: LoreAttachmentGroupFormValues, codeSuffix: string) => {
    const effective = group.template.trim().length ? group.template : fallbackTemplate;
    if (!effective.includes("{{payload.content}}")) {
      warnings.push({
        code: `lore_template_missing_content_${codeSuffix}`,
        level: "warning",
        message:
          "Lore entry template is missing {{payload.content}}, so the content of lore entries will not be included.",
      });
    }
  };

  checkGroupTemplate(draft.values.groups.beforeCharacters, "before_characters");
  checkGroupTemplate(draft.values.groups.afterCharacters, "after_characters");
  checkGroupTemplate(draft.values.groups.perTurn, "per_turn");
  return warnings;
}

export function cloneLoreAttachmentValues(
  values: LoreAttachmentFormValues
): LoreAttachmentFormValues {
  return {
    enabled: values.enabled,
    groups: {
      beforeCharacters: {
        role: values.groups.beforeCharacters.role,
        template: values.groups.beforeCharacters.template,
        open: values.groups.beforeCharacters.open,
        close: values.groups.beforeCharacters.close,
      },
      afterCharacters: {
        role: values.groups.afterCharacters.role,
        template: values.groups.afterCharacters.template,
        open: values.groups.afterCharacters.open,
        close: values.groups.afterCharacters.close,
      },
      perTurn: {
        role: values.groups.perTurn.role,
        template: values.groups.perTurn.template,
        open: values.groups.perTurn.open,
        close: values.groups.perTurn.close,
      },
    },
  };
}
