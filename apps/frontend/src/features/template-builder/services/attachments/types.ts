import type { AttachmentLaneSpec, ChatCompletionMessageRole } from "@storyforge/prompt-rendering";

export interface AttachmentLaneDraftBase<Type extends string, Values> {
  laneId: string;
  type: Type;
  spec: AttachmentLaneSpec;
  values: Values;
}

export type AttachmentWarningLevel = "info" | "warning" | "error";

export interface AttachmentWarning {
  code: string;
  level: AttachmentWarningLevel;
  message: string;
}

export interface LoreAttachmentGroupFormValues {
  role: ChatCompletionMessageRole;
  template: string;
  open: string;
  close: string;
}

export interface LoreAttachmentFormValues {
  enabled: boolean;
  groups: {
    beforeCharacters: LoreAttachmentGroupFormValues;
    afterCharacters: LoreAttachmentGroupFormValues;
    perTurn: LoreAttachmentGroupFormValues;
  };
}

export type LoreAttachmentLaneDraft = AttachmentLaneDraftBase<"lore", LoreAttachmentFormValues>;
