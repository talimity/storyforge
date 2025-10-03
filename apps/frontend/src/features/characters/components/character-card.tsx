import {
  Box,
  Card,
  HStack,
  IconButton,
  Image,
  Menu,
  Portal,
  Skeleton,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import {
  LuCheck,
  LuEllipsisVertical,
  LuPencilLine,
  LuSquareUserRound,
  LuTrash,
} from "react-icons/lu";
import { Link } from "react-router-dom";
import { CharacterDeleteDialog } from "@/features/characters/components/character-delete-dialog";
import { useCharacterActions } from "@/features/characters/hooks/use-character-actions";
import { getApiUrl } from "@/lib/get-api-url";

interface CharacterCardProps {
  character: {
    id: string;
    name: string;
    imagePath: string | null;
    avatarPath: string | null;
  };
  isSelected?: boolean;
  readOnly?: boolean;
}

export function CharacterCard({
  character,
  isSelected = false,
  readOnly = false,
}: CharacterCardProps) {
  const {
    isDeleteDialogOpen,
    deleteCharacterMutation,
    handleDelete,
    openDeleteDialog,
    closeDeleteDialog,
  } = useCharacterActions(character.id);

  const imageUrl = getApiUrl(character.imagePath);

  return (
    <>
      <Card.Root
        maxW="300px"
        layerStyle="surface"
        _hover={!readOnly ? { layerStyle: "interactive", shadow: "md" } : undefined}
        className={readOnly ? undefined : "group"}
        cursor={!readOnly ? "pointer" : "default"}
        data-character-id={character.id}
        overflow="hidden"
      >
        <Box position="relative" borderBottomWidth={1}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={character.name}
              aspectRatio={2 / 3}
              fit="cover"
              width="100%"
            />
          ) : (
            <Box
              aspectRatio={2 / 3}
              bg="gray.100"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color="gray.500"
            >
              <LuSquareUserRound size={64} />
            </Box>
          )}
          {!readOnly && (
            <Menu.Root positioning={{ placement: "bottom-end" }}>
              <Menu.Trigger asChild>
                <IconButton
                  aria-label="Character options"
                  variant="subtle"
                  size="sm"
                  position="absolute"
                  top={2}
                  right={2}
                  colorPalette="neutral"
                  opacity={0}
                  _groupHover={{ opacity: 1 }}
                  _focus={{ opacity: 1 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <LuEllipsisVertical />
                </IconButton>
              </Menu.Trigger>
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
          )}
        </Box>
        <Card.Body p={3}>
          <HStack>
            {isSelected && (
              <Box
                height="5"
                width="5"
                layerStyle="contrast"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <LuCheck size={16} color="white" />
                <VisuallyHidden>Selected</VisuallyHidden>
              </Box>
            )}
            <Text fontWeight="medium" fontSize="sm" truncate>
              {character.name}
            </Text>
          </HStack>
        </Card.Body>
      </Card.Root>
      {!readOnly && (
        <CharacterDeleteDialog
          isOpen={isDeleteDialogOpen}
          onOpenChange={() => closeDeleteDialog()}
          characterName={character.name}
          onConfirmDelete={handleDelete}
          isDeleting={deleteCharacterMutation.isPending}
        />
      )}
    </>
  );
}

export function CharacterCardSkeleton() {
  return (
    <Card.Root maxW="300px" variant="outline" overflow="hidden">
      <Skeleton aspectRatio={2 / 3} />
      <Card.Body p={4}>
        <Skeleton height="5" width="70%" />
      </Card.Body>
    </Card.Root>
  );
}
