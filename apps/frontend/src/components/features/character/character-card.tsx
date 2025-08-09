import {
  Box,
  Card,
  Dialog,
  IconButton,
  Image,
  Menu,
  Portal,
  Skeleton,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { LuMenu, LuPencilLine, LuTrash, LuUsers } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

interface CharacterCardProps {
  character: {
    id: string;
    name: string;
    description: string;
    imagePath: string | null;
  };
}

export function CharacterCard({ character }: CharacterCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const utils = trpc.useUtils();
  const deleteCharacterMutation = trpc.characters.delete.useMutation({
    onSuccess: () => {
      utils.characters.list.invalidate();
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      console.error("Failed to delete character:", error);
    },
  });

  const imageUrl = character.imagePath
    ? `http://localhost:3001/api/characters/${character.id}/image`
    : null;

  const handleDelete = () => {
    deleteCharacterMutation.mutate({ id: character.id });
  };

  return (
    <Card.Root
      width="240px"
      layerStyle="surface"
      overflow="hidden"
      className="group"
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
            <LuUsers size={64} />
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
              bg="bg.subtle"
              _hover={{ bg: "bg.muted" }}
              opacity={0}
              _groupHover={{ opacity: 1 }}
              _focus={{ opacity: 1 }}
              transition="opacity 0.2s ease-in-out"
            >
              <LuMenu />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value="edit">
                  <LuPencilLine />
                  <Box flex="1">Edit</Box>
                </Menu.Item>
                <Menu.Item
                  value="delete"
                  color="fg.error"
                  _hover={{ bg: "bg.error", color: "fg.error" }}
                  onClick={() => setIsDeleteDialogOpen(true)}
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
        <Text fontWeight="medium" fontSize="sm" truncate>
          {character.name}
        </Text>
      </Card.Body>

      <Dialog.Root
        role="alertdialog"
        open={isDeleteDialogOpen}
        onOpenChange={(e) => setIsDeleteDialogOpen(e.open)}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Delete Character</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>
                  Are you sure you want to delete "{character.name}"? This
                  action cannot be undone.
                </Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteDialogOpen(false)}
                    disabled={deleteCharacterMutation.isPending}
                  >
                    Cancel
                  </Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="red"
                  onClick={handleDelete}
                  loading={deleteCharacterMutation.isPending}
                  disabled={deleteCharacterMutation.isPending}
                >
                  Delete
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
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
