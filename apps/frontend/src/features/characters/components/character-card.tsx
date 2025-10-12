import {
  Box,
  Card,
  Heading,
  HStack,
  Icon,
  IconButton,
  Image,
  Menu,
  Portal,
  Skeleton,
  SkeletonText,
  VisuallyHidden,
} from "@chakra-ui/react";
import { memo } from "react";
import {
  LuCheck,
  LuEllipsisVertical,
  LuPencilLine,
  LuSquareUserRound,
  LuStar,
  LuTrash,
} from "react-icons/lu";
import { useInView } from "react-intersection-observer";
import { Link } from "react-router-dom";
import { CharacterDeleteDialog } from "@/features/characters/components/character-delete-dialog";
import { useCharacterActions } from "@/features/characters/hooks/use-character-actions";
import { useCharacterStar } from "@/features/characters/hooks/use-character-star";
import { getApiUrl } from "@/lib/get-api-url";

interface CharacterCardProps {
  character: {
    id: string;
    name: string;
    imagePath: string | null;
    avatarPath: string | null;
    isStarred?: boolean;
  };
  isSelected?: boolean;
  readOnly?: boolean;
}

// TODO: try to figure out why React Compiler auto-memo is not working here
export const CharacterCard = memo(function CharacterCard({
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
  const { toggleStar, isPendingFor } = useCharacterStar();
  // defer mounting heavy chakra menu/dialog components until in view
  const { ref, inView } = useInView({ triggerOnce: true });

  const imageUrl = getApiUrl(character.imagePath);

  return (
    <>
      <Card.Root
        maxW="300px"
        layerStyle="surface"
        className={readOnly ? undefined : "group"}
        cursor={readOnly ? "default" : "pointer"}
        data-character-id={character.id}
        overflow="hidden"
        ref={ref}
      >
        <Box position="relative" borderBottomWidth={1}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={character.name}
              aspectRatio={2 / 3}
              fit="cover"
              width="100%"
              loading="lazy"
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

          {/* Actions */}
          {!readOnly && inView && (
            <Menu.Root positioning={{ placement: "bottom-end" }}>
              <Menu.Trigger asChild>
                <IconButton
                  aria-label="Character options"
                  variant="solid"
                  size="sm"
                  position="absolute"
                  top={2}
                  right={2}
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
                    <Menu.Item
                      value={character.isStarred ? "unstar" : "star"}
                      onSelect={() => toggleStar(character.id, !character.isStarred)}
                      disabled={isPendingFor(character.id)}
                    >
                      <LuStar
                        fill={character.isStarred ? "currentColor" : "none"}
                        stroke="currentColor"
                      />
                      <Box flex="1">{character.isStarred ? "Unstar" : "Star"}</Box>
                    </Menu.Item>
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
            {character.isStarred && <Icon as={LuStar} color="accent.500" boxSize={4} />}
            <Heading as="h3" size="sm" fontWeight="bold" truncate>
              {character.name}
            </Heading>
          </HStack>
        </Card.Body>
      </Card.Root>

      {/* Dialogs */}
      {!readOnly && inView && (
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
});

export function CharacterCardSkeleton() {
  return (
    <Card.Root maxW="300px" variant="outline" overflow="hidden">
      <Skeleton aspectRatio={2 / 3} />
      <Card.Body p={3}>
        <SkeletonText h="5" noOfLines={1} width="70%" />
      </Card.Body>
    </Card.Root>
  );
}
