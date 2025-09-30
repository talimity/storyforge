import { Box, Group, HStack, Menu, MenuSeparator, Portal, Stack, Text } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/contracts";
import { memo, useCallback, useMemo, useState } from "react";
import {
  LuCheck,
  LuChevronRight,
  LuEllipsisVertical,
  LuFilePlus,
  LuGhost,
  LuInfo,
  LuListEnd,
  LuMoveDown,
  LuMoveUp,
  LuPencil,
  LuRefreshCw,
  LuTableOfContents,
  LuTrash,
  LuX,
} from "react-icons/lu";
import Markdown from "react-markdown";
import { DiscardChangesDialog } from "@/components/dialogs/discard-changes-dialog";
import { AutosizeTextarea, Avatar, Button, Prose } from "@/components/ui/index";
import { IntentProvenanceIndicator } from "@/features/scenario-player/components/timeline/intent-provenance-indicator";
import { getIntentProvenanceDisplay } from "@/features/scenario-player/components/timeline/intent-provenance-utils";
import { useBranchPreview } from "@/features/scenario-player/hooks/use-branch-preview";
import { useChapterActions } from "@/features/scenario-player/hooks/use-chapter-actions";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import {
  selectIsGenerating,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import { showSuccessToast } from "@/lib/error-handling";
import { getApiUrl } from "@/lib/get-api-url";
import { GenerationInfoDialog } from "./generation-info-dialog.js";

export interface TurnItemProps {
  turn: TimelineTurn;
  prevTurn: TimelineTurn | null;
  nextTurn: TimelineTurn | null;
  onDelete?: (turnId: string, cascade: boolean) => void;
  onEdit?: (turnId: string, content: string) => void;
  onRetry?: (turn: TimelineTurn) => void;
  onInsertManual?: (turn: TimelineTurn) => void;
  onToggleGhost?: (turnId: string, isGhost: boolean) => void;

  isUpdating?: boolean;
  isTogglingGhost?: boolean;
}

function TurnItemImpl(props: TurnItemProps) {
  const {
    turn,
    prevTurn,
    nextTurn,
    onDelete,
    onEdit,
    onRetry,
    onInsertManual,
    onToggleGhost,
    isUpdating,
    isTogglingGhost,
  } = props;
  const editingTurnId = useScenarioPlayerStore((state) => state.editingTurnId);
  const setEditingTurnId = useScenarioPlayerStore((state) => state.setEditingTurnId);
  const isEditing = editingTurnId === turn.id;
  const [editedContent, setEditedContent] = useState(turn.content.text);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showGenerationInfo, setShowGenerationInfo] = useState(false);
  const { getCharacterByParticipantId } = useScenarioContext();
  const authorChar = getCharacterByParticipantId(turn.authorParticipantId);
  const authorName = authorChar?.name ?? "Narrator";
  const avatarSrc = getApiUrl(authorChar?.avatarPath ?? undefined);
  const isGenerating = useIntentRunsStore(selectIsGenerating);
  const { isPreviewing, previewSibling } = useBranchPreview();
  const { insertChapterAtTurn, isInsertingChapter } = useChapterActions();

  const provenanceDisplay = useMemo(
    () => getIntentProvenanceDisplay(turn, prevTurn, nextTurn),
    [turn, prevTurn, nextTurn]
  );

  const isDirty = editedContent !== turn.content.text;

  const handleDelete = useCallback(
    (cascade: boolean) => onDelete?.(turn.id, cascade),
    [onDelete, turn.id]
  );

  const handleEditClick = useCallback(() => {
    setEditingTurnId(turn.id);
    setEditedContent(turn.content.text);
  }, [turn.content.text, turn.id, setEditingTurnId]);

  const handleSave = useCallback(() => {
    onEdit?.(turn.id, editedContent);
  }, [onEdit, turn.id, editedContent]);

  const handleCancel = useCallback(() => {
    // Show dialog if there are unsaved changes
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      setEditingTurnId(null);
      setEditedContent(turn.content.text);
    }
  }, [turn.content.text, isDirty, setEditingTurnId]);

  const handleConfirmDiscard = useCallback(() => {
    setEditingTurnId(null);
    setEditedContent(turn.content.text);
    setShowDiscardDialog(false);
  }, [turn.content.text, setEditingTurnId]);

  const doNothing = useCallback(() => {}, []);

  const handleToggleGhost = useCallback(() => {
    onToggleGhost?.(turn.id, !turn.isGhost);
  }, [onToggleGhost, turn.id, turn.isGhost]);

  const handleSwipe = useCallback(
    async (dir: "left" | "right") => {
      if (isGenerating) return;
      const siblingId = dir === "left" ? turn.swipes?.leftTurnId : turn.swipes?.rightTurnId;
      await previewSibling(siblingId);
    },
    [isGenerating, previewSibling, turn.swipes]
  );

  const handleRetry = useCallback(() => {
    onRetry?.(turn);
  }, [onRetry, turn]);

  const handleInsertManual = useCallback(() => {
    onInsertManual?.(turn);
  }, [onInsertManual, turn]);

  const handleGenerationInfo = useCallback(() => {
    setShowGenerationInfo(true);
  }, []);

  const handleGenerationInfoOpenChange = useCallback((details: { open: boolean }) => {
    setShowGenerationInfo(details.open);
  }, []);

  const handleInsertChapterBreak = useCallback(async () => {
    if (isGenerating) return;
    try {
      await insertChapterAtTurn({ turnId: turn.id });
      showSuccessToast({ title: "Chapter break inserted" });
    } catch {
      // error toast emitted in hook
    }
  }, [insertChapterAtTurn, isGenerating, turn.id]);

  const hasIntent = Boolean(turn.provenance);

  return (
    <>
      <Box
        layerStyle="surface"
        p={4}
        borderRadius="md"
        data-turn-id={turn.id}
        data-testid="turn-item"
        opacity={turn.isGhost ? 0.5 : 1}
      >
        <Stack gap={2}>
          <HStack justify="space-between" pb={1}>
            <HStack alignItems="center">
              {avatarSrc && (
                <Avatar
                  shape="rounded"
                  layerStyle="surface"
                  name={authorName}
                  src={avatarSrc}
                  size="md"
                />
              )}
              <Stack gap={0}>
                <Text fontSize="md" fontWeight="bold">
                  {authorName}
                </Text>
                <HStack gap={2}>
                  <Text fontSize="xs" color="content.muted">
                    #{turn.turnNo}
                  </Text>
                  {turn.isGhost ? (
                    <Text as="span" fontSize="xs" color="content.muted">
                      <LuGhost aria-label="Ghost turn" />
                    </Text>
                  ) : null}
                  {provenanceDisplay && <IntentProvenanceIndicator display={provenanceDisplay} />}
                </HStack>
              </Stack>
            </HStack>

            <HStack gap={2}>
              {isEditing ? (
                <HStack gap={1}>
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="green"
                    onClick={handleSave}
                    aria-label="Save changes"
                    disabled={isUpdating}
                    loading={isUpdating}
                  >
                    <LuCheck />
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={handleCancel}
                    aria-label="Cancel editing"
                    disabled={isUpdating}
                  >
                    <LuX />
                  </Button>
                </HStack>
              ) : (
                !isPreviewing && (
                  <Menu.Root
                    onFocusOutside={(details) => {
                      // janky workaround for  chakra issue with nested menus
                      // wherein race condition causes menu to inappropriately
                      // close in rare cases when mouseover leaves a submenu
                      details.preventDefault();
                      details.stopPropagation();
                    }}
                  >
                    <Menu.Trigger asChild>
                      <Button size="xs" variant="ghost" aria-label="Turn actions">
                        <LuEllipsisVertical />
                      </Button>
                    </Menu.Trigger>
                    <Portal>
                      <Menu.Positioner>
                        <Menu.Content>
                          {/* Edit | Regenerate */}
                          <Group grow gap="0">
                            <Menu.Item
                              value="edit"
                              width="16"
                              gap="1"
                              flexDirection="column"
                              justifyContent="center"
                              onClick={handleEditClick}
                            >
                              <LuPencil />
                              Edit
                            </Menu.Item>
                            <Menu.Item
                              value="retry"
                              width="16"
                              gap="1"
                              flexDirection="column"
                              justifyContent="center"
                              onClick={handleRetry}
                              disabled={isGenerating || !turn.parentTurnId}
                            >
                              <LuRefreshCw />
                              Retry
                            </Menu.Item>
                          </Group>

                          {/* Move Up */}
                          <Menu.Item value="move-up" onClick={doNothing}>
                            <LuMoveUp />
                            <Box flex="1">Move Up</Box>
                          </Menu.Item>

                          {/* Move Down */}
                          <Menu.Item value="move-down" onClick={doNothing}>
                            <LuMoveDown />
                            <Box flex="1">Move Down</Box>
                          </Menu.Item>

                          {/* Insert submenu */}
                          <Menu.Root>
                            <Menu.TriggerItem>
                              <LuListEnd />
                              <Box flex="1">Insert</Box>
                              <LuChevronRight />
                            </Menu.TriggerItem>
                            <Portal>
                              <Menu.Positioner>
                                <Menu.Content>
                                  <Menu.Item
                                    onClick={handleInsertManual}
                                    value="manual-turn"
                                    disabled={isGenerating || !onInsertManual}
                                  >
                                    <LuFilePlus />
                                    Manual Turn
                                  </Menu.Item>
                                  <Menu.Item
                                    onClick={() => {
                                      void handleInsertChapterBreak();
                                    }}
                                    value="chapter-break"
                                    disabled={isInsertingChapter || isGenerating}
                                  >
                                    <LuTableOfContents />
                                    Chapter Separator
                                  </Menu.Item>
                                </Menu.Content>
                              </Menu.Positioner>
                            </Portal>
                          </Menu.Root>

                          {/* Delete submenu */}
                          <Menu.Root>
                            <Menu.TriggerItem
                              color="fg.error"
                              _hover={{ bg: "bg.error", color: "fg.error" }}
                            >
                              <LuTrash />
                              <Box flex="1">Delete</Box>
                              <LuChevronRight />
                            </Menu.TriggerItem>
                            <Portal>
                              <Menu.Positioner>
                                <Menu.Content>
                                  <Menu.Item
                                    value="delete-single"
                                    color="fg.error"
                                    _hover={{ bg: "bg.error", color: "fg.error" }}
                                    onClick={() => handleDelete(false)}
                                  >
                                    This turn only
                                  </Menu.Item>
                                  <Menu.Item
                                    value="delete-cascade"
                                    color="fg.error"
                                    _hover={{ bg: "bg.error", color: "fg.error" }}
                                    onClick={() => handleDelete(true)}
                                  >
                                    This and all below
                                  </Menu.Item>
                                </Menu.Content>
                              </Menu.Positioner>
                            </Portal>
                          </Menu.Root>

                          <MenuSeparator />
                          <Menu.Item
                            value="toggle-ghost"
                            onClick={handleToggleGhost}
                            disabled={isTogglingGhost}
                          >
                            <LuGhost />
                            <Box flex="1">{turn.isGhost ? "Restore Turn" : "Ghost Turn"}</Box>
                          </Menu.Item>

                          <MenuSeparator />
                          {/* Generation Info */}
                          {hasIntent && (
                            <Menu.Item
                              value="generation-info"
                              onClick={handleGenerationInfo}
                              disabled={!hasIntent}
                            >
                              <LuInfo />
                              Gen Info
                            </Menu.Item>
                          )}
                        </Menu.Content>
                      </Menu.Positioner>
                    </Portal>
                  </Menu.Root>
                )
              )}
            </HStack>
          </HStack>
          {isEditing ? (
            <AutosizeTextarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              minRows={2}
              maxRows={50}
              autoFocus
            />
          ) : (
            // TODO: Make maxW configurable
            <Prose maxW="80ch" size="lg" data-testid="turn-content">
              <Markdown>{turn.content.text}</Markdown>
            </Prose>
          )}
          {turn.swipes && turn.swipes.swipeCount > 1 && (
            <HStack gap={2}>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => handleSwipe("left")}
                disabled={isGenerating || !turn.swipes.leftTurnId}
                aria-label="View previous alternate"
              >
                ←
              </Button>
              <Text fontSize="xs" color="content.muted">
                {turn.swipes.swipeNo} / {turn.swipes.swipeCount}
              </Text>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => handleSwipe("right")}
                disabled={isGenerating || !turn.swipes.rightTurnId}
                aria-label="View next alternate"
              >
                →
              </Button>
            </HStack>
          )}
        </Stack>
      </Box>

      <DiscardChangesDialog
        isOpen={showDiscardDialog}
        onOpenChange={(details) => setShowDiscardDialog(details.open)}
        onConfirm={handleConfirmDiscard}
      />
      <GenerationInfoDialog
        turnId={turn.id}
        isOpen={showGenerationInfo}
        onOpenChange={handleGenerationInfoOpenChange}
      />
    </>
  );
}

export const TurnItem = memo(
  TurnItemImpl,
  (prev, next) =>
    prev.turn.id === next.turn.id &&
    prev.turn.turnNo === next.turn.turnNo &&
    prev.turn.content.text === next.turn.content.text &&
    prev.turn.swipes?.swipeNo === next.turn.swipes?.swipeNo &&
    prev.turn.swipes?.swipeCount === next.turn.swipes?.swipeCount &&
    prev.turn.provenance?.intentStatus === next.turn.provenance?.intentStatus &&
    prev.turn.isGhost === next.turn.isGhost
);
