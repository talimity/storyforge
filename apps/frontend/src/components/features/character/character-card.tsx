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
  LuMenu,
  LuPencilLine,
  LuSquareUserRound,
  LuTrash,
} from "react-icons/lu";
import { CharacterDeleteDialog } from "@/components/dialogs/character-delete";
import { useCharacterActions } from "@/components/features/character/use-character-actions";

interface CharacterCardProps {
  character: {
    id: string;
    name: string;
    imagePath: string | null;
    avatarPath: string | null;
  };
  isSelected?: boolean;
  onSelectionToggle?: () => void;
}

export function CharacterCard({
  character,
  isSelected = false,
  onSelectionToggle,
}: CharacterCardProps) {
  const {
    isDeleteDialogOpen,
    deleteCharacterMutation,
    handleDelete,
    handleEdit,
    openDeleteDialog,
    closeDeleteDialog,
  } = useCharacterActions(character.id);

  const imageUrl = character.imagePath
    ? `http://localhost:3001/api/characters/${character.id}/image`
    : null;

  return (
    <Card.Root
      width="240px"
      layerStyle="surface"
      overflow="hidden"
      className="group"
      cursor={onSelectionToggle ? "pointer" : "default"}
      onClick={onSelectionToggle}
    >
      <Box position="relative">
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
              <LuMenu />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value="edit" onClick={handleEdit}>
                  <LuPencilLine />
                  <Box flex="1">Edit</Box>
                </Menu.Item>
                <Menu.Item
                  value="delete"
                  color="fg.error"
                  _hover={{ bg: "bg.error", color: "fg.error" }}
                  onClick={openDeleteDialog}
                  disabled={deleteCharacterMutation.isPending}
                >
                  <LuTrash />
                  <Box flex="1">Delete</Box>
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </Box>
      <Card.Body p={3}>
        <HStack>
          {isSelected && (
            <Box
              height="20px"
              width="20px"
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
      <CharacterDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={() => closeDeleteDialog()}
        characterName={character.name}
        onConfirmDelete={handleDelete}
        isDeleting={deleteCharacterMutation.isPending}
      />
    </Card.Root>
  );
}

export function CharacterCardSkeleton() {
  return (
    <Card.Root width="240px" variant="outline" overflow="hidden">
      <Skeleton aspectRatio={2 / 3} />
      <Card.Body p={3}>
        <Skeleton height="5" width="70%" />
      </Card.Body>
    </Card.Root>
  );
}
