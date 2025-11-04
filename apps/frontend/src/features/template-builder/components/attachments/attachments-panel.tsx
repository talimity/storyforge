import { List, VStack } from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/gentasks";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { Alert } from "@/components/ui";
import {
  ensureChapterSeparatorAttachmentDraft,
  getChapterSeparatorAttachmentWarnings,
} from "@/features/template-builder/services/attachments/chapters";
import {
  ensureLoreAttachmentDraft,
  getLoreAttachmentWarnings,
} from "@/features/template-builder/services/attachments/lore";
import { useTemplateBuilderStore } from "@/features/template-builder/stores/template-builder-store";
import { ChapterSeparatorAttachmentsForm } from "./chapter-separator-attachments-form";
import { LoreAttachmentsForm } from "./lore-attachments-form";

interface AttachmentsPanelProps {
  task: TaskKind;
}

export function AttachmentsPanel({ task }: AttachmentsPanelProps) {
  const showLore = task === "turn_generation";
  const showChapterSeparators = task === "turn_generation" || task === "chapter_summarization";

  const { attachmentDrafts, setAttachmentDraft } = useTemplateBuilderStore(
    useShallow((state) => ({
      attachmentDrafts: state.attachmentDrafts,
      setAttachmentDraft: state.setAttachmentDraft,
    }))
  );

  const storedLoreDraft = attachmentDrafts.lore;
  const storedSeparatorDraft = attachmentDrafts.chapter_separators;

  const loreDraft = showLore
    ? ensureLoreAttachmentDraft(
        storedLoreDraft && storedLoreDraft.type === "lore" ? storedLoreDraft : undefined
      )
    : undefined;
  const separatorDraft = showChapterSeparators
    ? ensureChapterSeparatorAttachmentDraft(
        storedSeparatorDraft && storedSeparatorDraft.type === "chapter_separators"
          ? storedSeparatorDraft
          : undefined
      )
    : undefined;

  const warnings = [
    ...(loreDraft ? getLoreAttachmentWarnings(loreDraft) : []),
    ...(separatorDraft ? getChapterSeparatorAttachmentWarnings(separatorDraft) : []),
  ];

  useEffect(() => {
    if (showLore && !attachmentDrafts.lore && loreDraft) {
      setAttachmentDraft(loreDraft);
    }
    if (showChapterSeparators && !attachmentDrafts.chapter_separators && separatorDraft) {
      setAttachmentDraft(separatorDraft);
    }
  }, [
    attachmentDrafts.chapter_separators,
    attachmentDrafts.lore,
    loreDraft,
    separatorDraft,
    setAttachmentDraft,
    showChapterSeparators,
    showLore,
  ]);

  if (!showLore && !showChapterSeparators) {
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
      {loreDraft ? <LoreAttachmentsForm draft={loreDraft} onChange={setAttachmentDraft} /> : null}
      {separatorDraft ? (
        <ChapterSeparatorAttachmentsForm draft={separatorDraft} onChange={setAttachmentDraft} />
      ) : null}
    </VStack>
  );
}
