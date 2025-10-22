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

export interface LoreAttachmentFormValues {
  enabled: boolean;
  role: ChatCompletionMessageRole;
  template: string;
  groups: {
    beforeCharacters: {
      open: string;
      close: string;
    };
    afterCharacters: {
      open: string;
      close: string;
    };
    perTurn: {
      open: string;
      close: string;
    };
  };
}

export type LoreAttachmentLaneDraft = AttachmentLaneDraftBase<"lore", LoreAttachmentFormValues>;
