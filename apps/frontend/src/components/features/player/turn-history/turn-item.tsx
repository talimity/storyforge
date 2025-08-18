import { Box, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/schemas";
import { memo, useCallback, useState } from "react";
import { LuCheck, LuPencil, LuTrash2, LuX } from "react-icons/lu";
import { DiscardChangesDialog } from "@/components/dialogs/discard-changes";
import { Avatar, Button } from "@/components/ui/index";
import { useScenarioCtx } from "@/lib/providers/scenario-provider";
import { getApiUrl } from "@/lib/trpc";

interface TurnItemProps {
  turn: TimelineTurn;
  onDelete?: (turnId: string) => void;
  onEdit?: (turnId: string, content: string) => void;
  isDeleting?: boolean;
  isUpdating?: boolean;
}

function TurnItemImpl({
  turn,
  onDelete,
  onEdit,
  isDeleting,
  isUpdating,
}: TurnItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(turn.content.text);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const { getCharacterByParticipantId } = useScenarioCtx();
  const authorChar = getCharacterByParticipantId(turn.authorParticipantId);
  const authorName = authorChar?.name ?? "Narrator";
  const avatarSrc = getApiUrl(authorChar?.avatarPath ?? undefined);

  // Track if content has been modified
  const isDirty = editedContent !== turn.content.text;

  const handleDelete = useCallback(
    () => onDelete?.(turn.id),
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

  return (
    <>
      <Box layerStyle="surface" p={4} borderRadius="md">
        <Stack gap={2}>
          <HStack justify="space-between" mb={1}>
            <HStack alignItems="center" mx={-1}>
              {avatarSrc && (
                <Avatar
                  shape="rounded"
                  layerStyle="surface"
                  name={authorName}
                  src={avatarSrc}
                  size="2xs"
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
              {!isEditing && (
                <HStack gap={1}>
                  {onEdit && (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={handleEditClick}
                      aria-label="Edit turn"
                      disabled={isDeleting || isUpdating}
                    >
                      <LuPencil />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      size="xs"
                      variant="ghost"
                      colorPalette="red"
                      onClick={handleDelete}
                      aria-label="Delete turn"
                      disabled={isDeleting || isUpdating}
                      loading={isDeleting}
                    >
                      <LuTrash2 />
                    </Button>
                  )}
                </HStack>
              )}
              {isEditing && (
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
              )}
            </HStack>
          </HStack>
          {isEditing ? (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              minH="100px"
              autoFocus
            />
          ) : (
            <Text whiteSpace="pre-wrap">{turn.content.text}</Text>
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
