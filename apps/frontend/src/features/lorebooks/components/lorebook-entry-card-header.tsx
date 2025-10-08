import { Badge, Card, HStack, IconButton, Text } from "@chakra-ui/react";
import { LuCheck, LuChevronDown, LuChevronUp, LuCopy, LuPencilLine, LuTrash } from "react-icons/lu";
import type { LorebookEntryCardProps } from "@/features/lorebooks/components/lorebook-entry-card";

export function LorebookEntryCardHeader(
  props: LorebookEntryCardProps & { isEditing: boolean; isEnabled: boolean; entryTitle: string }
) {
  const {
    isEditing,
    isEnabled,
    entryTitle,
    onMoveUp,
    onMoveDown,
    onDuplicate,
    onRemove,
    onEdit,
    onDismiss,
    index,
    total,
  } = props;

  return (
    <Card.Header>
      <HStack justify="space-between" align="center" width="full">
        <HStack onClick={isEditing ? onDismiss : onEdit} cursor="pointer" flex={1}>
          {isEditing ? (
            <IconButton
              aria-label="Stop editing this entry"
              size="xs"
              variant="ghost"
              onClick={onDismiss}
            >
              <LuCheck />
            </IconButton>
          ) : (
            <IconButton aria-label="Edit this entry" size="xs" variant="ghost" onClick={onEdit}>
              <LuPencilLine />
            </IconButton>
          )}
          <Text fontWeight="medium">
            {entryTitle ? `#${index + 1} · ${entryTitle}` : `Entry #${index + 1}`}
          </Text>
        </HStack>

        <HStack gap={2}>
          {!isEnabled && (
            <Badge colorPalette="orange" variant="subtle">
              Disabled
            </Badge>
          )}
          <IconButton
            aria-label="Move up"
            size="xs"
            variant="ghost"
            onClick={onMoveUp}
            disabled={index === 0}
          >
            <LuChevronUp />
          </IconButton>
          <IconButton
            aria-label="Move down"
            size="xs"
            variant="ghost"
            onClick={onMoveDown}
            disabled={index === total - 1}
          >
            <LuChevronDown />
          </IconButton>
          <IconButton aria-label="Duplicate" size="xs" variant="ghost" onClick={onDuplicate}>
            <LuCopy />
          </IconButton>
          <IconButton
            aria-label="Delete"
            size="xs"
            variant="ghost"
            colorPalette="red"
            onClick={onRemove}
          >
            <LuTrash />
          </IconButton>
        </HStack>
      </HStack>
    </Card.Header>
  );
}
