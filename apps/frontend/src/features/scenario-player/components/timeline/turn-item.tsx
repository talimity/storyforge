import {
  Box,
  Group,
  HStack,
  Menu,
  Portal,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/schemas";
import { memo, useCallback, useState } from "react";
import {
  LuBetweenHorizontalEnd,
  LuCheck,
  LuChevronRight,
  LuEllipsisVertical,
  LuMoveDown,
  LuMoveUp,
  LuPencil,
  LuRefreshCw,
  LuTrash,
  LuX,
} from "react-icons/lu";
import Markdown from "react-markdown";
import { DiscardChangesDialog } from "@/components/dialogs/discard-changes-dialog";
import { Avatar, Button, Prose } from "@/components/ui/index";
import { useScenarioCtx } from "@/features/scenario-player/providers/scenario-provider";
import { getApiUrl } from "@/lib/trpc";

interface TurnItemProps {
  turn: TimelineTurn;
  onDelete?: (turnId: string, cascade: boolean) => void;
  onEdit?: (turnId: string, content: string) => void;

  isUpdating?: boolean;
}

function TurnItemImpl({ turn, onDelete, onEdit, isUpdating }: TurnItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(turn.content.text);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const { getCharacterByParticipantId } = useScenarioCtx();
  const authorChar = getCharacterByParticipantId(turn.authorParticipantId);
  const authorName = authorChar?.name ?? "Narrator";
  const avatarSrc = getApiUrl(authorChar?.avatarPath ?? undefined);

  const isDirty = editedContent !== turn.content.text;

  const handleDelete = useCallback(
    (cascade: boolean) => onDelete?.(turn.id, cascade),
    [onDelete, turn.id]
  );

  const handleEditClick = useCallback(() => {
    setIsEditing(true);
    setEditedContent(turn.content.text);
  }, [turn.content.text]);

  const handleSave = useCallback(() => {
    onEdit?.(turn.id, editedContent);
    setIsEditing(false);
  }, [onEdit, turn.id, editedContent]);

  const handleCancel = useCallback(() => {
    // Show dialog if there are unsaved changes
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      setIsEditing(false);
      setEditedContent(turn.content.text);
    }
  }, [turn.content.text, isDirty]);

  const handleConfirmDiscard = useCallback(() => {
    setIsEditing(false);
    setEditedContent(turn.content.text);
    setShowDiscardDialog(false);
  }, [turn.content.text]);

  const doNothing = useCallback(() => {}, []);

  return (
    <>
      <Box layerStyle="surface" p={4} borderRadius="md">
        <Stack gap={2}>
          <HStack justify="space-between" mb={1}>
            <HStack alignItems="center">
              {avatarSrc && (
                <Avatar
                  shape="rounded"
                  layerStyle="surface"
                  name={authorName}
                  src={avatarSrc}
                  size="xs"
                />
              )}
              <Text fontSize="md" fontWeight="bold" color="content.emphasized">
                {authorName}
              </Text>
            </HStack>

            <HStack gap={2}>
              <Text fontSize="xs" color="content.muted">
                #{turn.turnNo}
              </Text>
              {isEditing ? (
                <HStack gap={1}>
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="primary"
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
                    onClick={handleCancel}
                    aria-label="Cancel editing"
                    disabled={isUpdating}
                  >
                    <LuX />
                  </Button>
                </HStack>
              ) : (
                <Menu.Root>
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
                            value="regenerate"
                            width="16"
                            gap="1"
                            flexDirection="column"
                            justifyContent="center"
                            onClick={doNothing}
                          >
                            <LuRefreshCw />
                            Regen
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
                            <LuBetweenHorizontalEnd />
                            <Box flex="1">Insert</Box>
                            <LuChevronRight />
                          </Menu.TriggerItem>
                          <Portal>
                            <Menu.Positioner>
                              <Menu.Content>
                                <Menu.Item
                                  onClick={doNothing}
                                  value="chapter-break"
                                >
                                  Chapter Break...
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
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              )}
            </HStack>
          </HStack>
          {isEditing ? (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              minH="100px"
              autoFocus
              autoresize
            />
          ) : (
            // TODO: Make maxW configurable
            <Prose size="lg" maxW="70ch">
              <Markdown>{turn.content.text}</Markdown>
            </Prose>
          )}
          {turn.swipes && turn.swipes.swipeCount > 1 && (
            <Text fontSize="xs" color="content.muted">
              {turn.swipes.swipeNo} / {turn.swipes.swipeCount}
            </Text>
          )}
        </Stack>
      </Box>

      <DiscardChangesDialog
        isOpen={showDiscardDialog}
        onOpenChange={(details) => setShowDiscardDialog(details.open)}
        onConfirm={handleConfirmDiscard}
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
    prev.turn.swipes?.swipeCount === next.turn.swipes?.swipeCount
);
