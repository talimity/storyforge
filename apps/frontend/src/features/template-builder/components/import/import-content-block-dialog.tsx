import { HStack, IconButton, Input, Spinner, Text, VStack } from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/gentasks";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LuCopyPlus, LuFilter } from "react-icons/lu";
import { Alert, Button, Dialog } from "@/components/ui";
import { ImportBlockOptionList } from "@/features/template-builder/components/import/import-block-option-list";
import type { SlotBlockDraft } from "@/features/template-builder/services/template-import";
import {
  cloneSlotBlockDraft,
  extractSlotBlocks,
} from "@/features/template-builder/services/template-import";
import { useTemplateBuilderStore } from "@/features/template-builder/stores/template-builder-store";
import { TemplateSingleSelect } from "@/features/templates/components/template-selector";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

interface ImportContentBlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  task?: TaskKind;
  insertionIndex?: number;
  templateId?: string;
  initialName?: string;
  isNameEditable?: boolean;
  overwriteOnImport?: boolean;
  confirmLabel?: string;
  onImportComplete?: (result: { slotName: string; mode: "added" | "overwritten" }) => void;
}

export function ImportContentBlockDialog({
  isOpen,
  onClose,
  task,
  insertionIndex,
  templateId,
  initialName,
  isNameEditable = true,
  overwriteOnImport = false,
  confirmLabel = "Import Content Block",
  onImportComplete,
}: ImportContentBlockDialogProps) {
  const trpc = useTRPC();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedBlockName, setSelectedBlockName] = useState<string | null>(null);
  const [targetName, setTargetName] = useState(initialName ?? "");
  const [limitToTask, setLimitToTask] = useState(true);

  const importSlotBlock = useTemplateBuilderStore((state) => state.importSlotBlock);
  const slotsDraft = useTemplateBuilderStore((state) => state.slotsDraft);

  const templateQuery = useQuery(
    trpc.templates.getById.queryOptions(
      { id: selectedTemplateId ?? "" },
      { enabled: Boolean(selectedTemplateId) }
    )
  );

  const templateDetail = templateQuery.data;

  const importableBlocks = useMemo(() => {
    if (!templateDetail) return [] as SlotBlockDraft[];
    return extractSlotBlocks(templateDetail);
  }, [templateDetail]);

  const selectedBlock = useMemo(() => {
    if (!selectedBlockName) return undefined;
    return importableBlocks.find((block) => block.slot.name === selectedBlockName);
  }, [importableBlocks, selectedBlockName]);

  useEffect(() => {
    if (!selectedBlock || !isNameEditable) return;
    setTargetName((prev) => (prev ? prev : selectedBlock.slot.name));
  }, [selectedBlock, isNameEditable]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedTemplateId(null);
      setSelectedBlockName(null);
      setTargetName(initialName ?? "");
      setLimitToTask(true);
      return;
    }

    if (initialName !== undefined) {
      setTargetName(initialName);
    }
  }, [isOpen, initialName]);

  const normalizedTargetName = targetName.trim();
  const slotExists = normalizedTargetName.length > 0 && Boolean(slotsDraft[normalizedTargetName]);

  const isImportDisabled =
    !selectedTemplateId ||
    !selectedBlock ||
    normalizedTargetName.length === 0 ||
    templateQuery.isLoading;

  const handleImport = useCallback(async () => {
    if (!selectedBlock || normalizedTargetName.length === 0) return;

    try {
      const block = cloneSlotBlockDraft(selectedBlock);
      block.slot.name = normalizedTargetName;
      block.layout.name = normalizedTargetName;

      const result = importSlotBlock(block, {
        insertionIndex,
        overwrite: overwriteOnImport || slotExists,
      });

      showSuccessToast({
        title: result.mode === "overwritten" ? "Content block updated" : "Content block added",
        description:
          result.mode === "overwritten"
            ? `Replaced "${block.slot.name}" with content from the selected template.`
            : `Added "${block.slot.name}" to your layout.`,
      });
      onClose();
      onImportComplete?.(result);
    } catch (error) {
      showErrorToast({
        title: "Unable to import block",
        fallbackMessage: "Something went wrong while importing the content block.",
        error,
      });
    }
  }, [
    importSlotBlock,
    insertionIndex,
    onClose,
    onImportComplete,
    overwriteOnImport,
    selectedBlock,
    normalizedTargetName,
    slotExists,
  ]);

  const handleTemplateChange = (id: string | null) => {
    setSelectedTemplateId(id);
    setSelectedBlockName(null);
    setTargetName(isNameEditable ? "" : (initialName ?? ""));
  };

  const handleBlockSelect = (blockName: string) => {
    setSelectedBlockName(blockName);
    if (isNameEditable) {
      setTargetName(blockName);
    }
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      size="lg"
    >
      <Dialog.Content>
        <Dialog.CloseTrigger />
        <Dialog.Header>
          <Dialog.Title>
            <HStack gap={2}>
              <LuCopyPlus />
              <Text>Import Content Block</Text>
            </HStack>
          </Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <VStack align="stretch" gap={6}>
            <Text fontSize="sm" color="content.muted">
              Copy a prepared content block from another template and drop it directly into the one
              you’re building now.
            </Text>

            <VStack align="stretch" gap={2}>
              <HStack align="center" justify="space-between" gap={2}>
                <TemplateSingleSelect
                  value={selectedTemplateId}
                  onChange={handleTemplateChange}
                  disabled={templateQuery.isFetching}
                  task={limitToTask ? task : undefined}
                  placeholder="Search templates..."
                  inDialog
                  flex={1}
                  excludeIds={templateId ? [templateId] : undefined}
                />
                <IconButton
                  aria-label={
                    limitToTask
                      ? "Show templates from any task type"
                      : "Limit search to matching task type"
                  }
                  variant={limitToTask ? "solid" : "outline"}
                  colorPalette={limitToTask ? "primary" : "neutral"}
                  onClick={() => setLimitToTask((prev) => !prev)}
                >
                  <LuFilter />
                </IconButton>
              </HStack>
            </VStack>

            {templateQuery.isLoading && (
              <HStack justify="center" py={4}>
                <Spinner />
                <Text fontSize="sm" color="content.muted">
                  Loading template…
                </Text>
              </HStack>
            )}

            {templateQuery.error && (
              <Alert status="error" title="Could not load template">
                {templateQuery.error.message}
              </Alert>
            )}

            {selectedTemplateId && !templateQuery.isLoading && importableBlocks.length === 0 && (
              <Alert status="info">
                <Text fontSize="sm">
                  The selected template does not contain any content blocks that can be imported.
                </Text>
              </Alert>
            )}

            {importableBlocks.length > 0 && (
              <VStack align="stretch" gap={3}>
                <Text fontSize="sm" fontWeight="medium">
                  Choose a content block to import
                </Text>
                <ImportBlockOptionList
                  blocks={importableBlocks}
                  selectedBlockName={selectedBlockName}
                  onSelect={handleBlockSelect}
                />
              </VStack>
            )}

            {selectedBlock && (
              <VStack align="stretch" gap={4}>
                <VStack align="stretch" gap={2}>
                  <Text fontSize="sm" fontWeight="medium">
                    New Content Block ID
                  </Text>
                  <Input
                    value={targetName}
                    onChange={(event) => setTargetName(event.target.value)}
                    placeholder="Enter block ID"
                    disabled={!isNameEditable}
                  />
                  {slotExists && (
                    <Text mt={1} fontSize="xs" color="fg.warning">
                      A block with this name already exists. Importing will replace it.
                    </Text>
                  )}
                </VStack>

                {selectedBlock.slot.recipeId === "custom" && (
                  <Alert status="warning">
                    <Text fontSize="xs">
                      This block uses a custom specification. Ensure the referenced data sources
                      exist in the current template.
                    </Text>
                  </Alert>
                )}

                {!limitToTask && task && templateDetail?.task && templateDetail.task !== task && (
                  <Alert status="warning">
                    <Text fontSize="xs">
                      Heads-up: this content comes from a different task type and might rely on data
                      your template doesn’t provide.
                    </Text>
                  </Alert>
                )}
              </VStack>
            )}
          </VStack>
        </Dialog.Body>
        <Dialog.Footer>
          <HStack justify="flex-end" gap={2}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button colorPalette="primary" onClick={handleImport} disabled={isImportDisabled}>
              {confirmLabel}
            </Button>
          </HStack>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
