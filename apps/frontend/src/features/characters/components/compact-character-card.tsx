import {
  Bleed,
  Box,
  Heading,
  HStack,
  IconButton,
  Menu,
  Portal,
  Skeleton,
  Stack,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import type { CardType } from "@storyforge/contracts";
import {
  LuCheck,
  LuEllipsisVertical,
  LuPencilLine,
  LuSquareUserRound,
  LuStar,
  LuTrash,
} from "react-icons/lu";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/ui/index";
import { cardTypeLabels } from "@/features/characters/character-enums";
import { CharacterDeleteDialog } from "@/features/characters/components/character-delete-dialog";
import { useCharacterActions } from "@/features/characters/hooks/use-character-actions";
import { useCharacterStar } from "@/features/characters/hooks/use-character-star";
import { getApiUrl } from "@/lib/get-api-url";

interface CompactCharacterCardProps {
  character: {
    id: string;
    name: string;
    cardType: CardType;
    avatarPath: string | null;
    isStarred?: boolean;
  };
  isSelected?: boolean;
}

export function CompactCharacterCard({ character, isSelected = false }: CompactCharacterCardProps) {
  const {
    isDeleteDialogOpen,
    deleteCharacterMutation,
    handleDelete,
    openDeleteDialog,
    closeDeleteDialog,
  } = useCharacterActions(character.id);
  const { toggleStar, isPendingFor } = useCharacterStar();

  return (
    <>
      <HStack
        gap={4}
        p={2}
        borderRadius="md"
        layerStyle="surface"
        cursor="pointer"
        data-character-id={character.id}
        _hover={{ bg: "bg.muted" }}
        className="group"
        position="relative"
        width="100%"
        minWidth={0}
        overflow="hidden"
      >
        <Bleed inlineStart={2} block={2}>
          <Box borderRightWidth={1}>
            <Avatar
              size="2xl"
              shape="square"
              name={character.name}
              src={character.avatarPath ? getApiUrl(character.avatarPath) : undefined}
              icon={<LuSquareUserRound size={20} />}
            />
          </Box>
        </Bleed>

        <Stack gap={0} flex={1} minWidth={0}>
          <HStack minWidth={0} width="100%">
            {isSelected && (
              <Box
                height="20px"
                width="20px"
                layerStyle="contrast"
                display="flex"
                alignItems="center"
                justifyContent="center"
                borderRadius="sm"
              >
                <LuCheck size={16} color="white" />
                <VisuallyHidden>Selected</VisuallyHidden>
              </Box>
            )}
            <Heading as="h3" size="md" fontWeight="bold" truncate flex={1} minWidth={0}>
              {character.name}
            </Heading>
          </HStack>
          <Text fontSize="sm" color="content.muted">
            {cardTypeLabels[character.cardType]}
          </Text>
        </Stack>

        <IconButton
          aria-label={character.isStarred ? "Unstar character" : "Star character"}
          size="xs"
          variant={character.isStarred ? "solid" : "ghost"}
          colorPalette={character.isStarred ? "accent" : "neutral"}
          onClick={(event) => {
            event.stopPropagation();
            toggleStar(character.id, !character.isStarred);
          }}
          loading={isPendingFor(character.id)}
        >
          <LuStar fill={character.isStarred ? "currentColor" : "none"} stroke="currentColor" />
        </IconButton>

        <Menu.Root positioning={{ placement: "bottom-end" }}>
          <Box display="flex" alignItems="center">
            <Menu.Trigger asChild>
              <IconButton
                aria-label="Character options"
                variant="plain"
                size="xs"
                opacity={0}
                _groupHover={{ opacity: 1 }}
                _focus={{ opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
              >
                <LuEllipsisVertical />
              </IconButton>
            </Menu.Trigger>
          </Box>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value="edit" asChild>
                  <Link to={`/characters/${character.id}/edit`}>
                    <LuPencilLine />
                    <Box flex="1">Edit</Box>
                  </Link>
                </Menu.Item>
                <Menu.Item
                  value="delete"
                  color="fg.error"
                  _hover={{ bg: "bg.error", color: "fg.error" }}
                  onSelect={openDeleteDialog}
                  disabled={deleteCharacterMutation.isPending}
                >
                  <LuTrash />
                  <Box flex="1">Delete</Box>
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>

      <CharacterDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={(_e) => closeDeleteDialog()}
        characterName={character.name}
        onConfirmDelete={handleDelete}
        isDeleting={deleteCharacterMutation.isPending}
      />
    </>
  );
}

export function CompactCharacterCardSkeleton() {
  return (
    <HStack gap={4} p={3} borderRadius="md" layerStyle="surface" cursor="default" opacity={0.6}>
      <Skeleton width="40px" height="40px" borderRadius="md" />
      <Stack gap={0} flex={1} minWidth={0}>
        <Skeleton width="100px" height="16px" borderRadius="md" />
        <Skeleton width="80px" height="14px" borderRadius="md" />
      </Stack>
    </HStack>
  );
}
