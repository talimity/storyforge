import { List, VStack } from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/gentasks";
import { useShallow } from "zustand/react/shallow";
import { Alert } from "@/components/ui";
import {
  ensureLoreAttachmentDraft,
  getLoreAttachmentWarnings,
} from "@/features/template-builder/services/attachments/lore";
import { useTemplateBuilderStore } from "@/features/template-builder/stores/template-builder-store";
import { LoreAttachmentsForm } from "./lore-attachments-form";

interface AttachmentsPanelProps {
  task: TaskKind;
}

export function AttachmentsPanel({ task }: AttachmentsPanelProps) {
  const isTurnGen = task === "turn_generation";

  const { attachmentDrafts, setAttachmentDraft } = useTemplateBuilderStore(
    useShallow((state) => ({
      attachmentDrafts: state.attachmentDrafts,
      setAttachmentDraft: state.setAttachmentDraft,
    }))
  );

  const loreDraft = attachmentDrafts.lore ?? ensureLoreAttachmentDraft();
  const warnings = getLoreAttachmentWarnings(loreDraft);

  if (!isTurnGen) {
    return null;
  }

  return (
    <VStack align="stretch" gap={4}>
      {warnings.length > 0 && (
        <Alert title="Potential issues" status="warning">
          <List.Root>
            {warnings.map((warning) => (
              <List.Item key={warning.code}>{warning.message}</List.Item>
            ))}
          </List.Root>
        </Alert>
      )}

      <LoreAttachmentsForm draft={loreDraft} onChange={setAttachmentDraft} />
    </VStack>
  );
}
