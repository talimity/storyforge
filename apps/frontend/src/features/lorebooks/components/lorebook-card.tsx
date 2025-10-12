import {
  Box,
  Card,
  Heading,
  HStack,
  IconButton,
  LinkOverlay,
  Menu,
  Portal,
  Skeleton,
  SkeletonText,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { LorebookSummary } from "@storyforge/contracts";
import { LuEllipsisVertical, LuPencilLine, LuTrash } from "react-icons/lu";
import { Link } from "react-router-dom";
import { useLorebookActions } from "../hooks/use-lorebook-actions";
import { DeleteLorebookDialog } from "./delete-lorebook-dialog";

interface LorebookCardProps {
  lorebook: LorebookSummary;
}

export function LorebookCard({ lorebook }: LorebookCardProps) {
  const actions = useLorebookActions(lorebook.id);
  const updatedLabel = new Date(lorebook.updatedAt).toLocaleString();

  return (
    <>
      <Card.Root size="sm" layerStyle="surface">
        <Card.Header>
          <HStack justify="space-between" align="center">
            <Heading size="md" truncate>
              <LinkOverlay asChild>
                <Link to={`/lorebooks/${lorebook.id}/edit`}>{lorebook.name}</Link>
              </LinkOverlay>
            </Heading>
            <Menu.Root positioning={{ placement: "bottom-end" }}>
              <Menu.Trigger asChild>
                <IconButton
                  aria-label="Lorebook actions"
                  variant="ghost"
                  size="xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <LuEllipsisVertical />
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.Item value="edit" asChild>
                      <Link to={`/lorebooks/${lorebook.id}/edit`}>
                        <LuPencilLine />
                        <Box flex="1">Edit</Box>
                      </Link>
                    </Menu.Item>
                    <Menu.Item
                      value="delete"
                      color="fg.error"
                      _hover={{ bg: "bg.error", color: "fg.error" }}
                      onSelect={actions.openDeleteDialog}
                    >
                      <LuTrash />
                      <Box flex="1">Delete</Box>
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </HStack>
        </Card.Header>
        <Card.Body p={4}>
          <Stack gap={1} fontSize="sm" color="content.muted">
            {lorebook.description && <Text lineClamp={2}>{lorebook.description}</Text>}
            <Text>Entries: {lorebook.entryCount}</Text>
            <Text>Updated {updatedLabel}</Text>
          </Stack>
        </Card.Body>
      </Card.Root>

      <DeleteLorebookDialog
        lorebook={{ id: lorebook.id, name: lorebook.name }}
        isOpen={actions.isDeleteDialogOpen}
        onOpenChange={(open) => (open ? actions.openDeleteDialog() : actions.closeDeleteDialog())}
        onDelete={actions.handleDelete}
        isDeleting={actions.deleteLorebookMutation.isPending}
      />
    </>
  );
}

export function LorebookCardSkeleton() {
  return (
    <Card.Root size="sm" variant="outline">
      <Card.Header>
        <HStack justify="space-between" align="center">
          <SkeletonText noOfLines={1} h="5" width="70%" />
          <Skeleton w="8" h="8" rounded="md" />
        </HStack>
      </Card.Header>
      <Card.Body p={4}>
        <VStack align="start">
          <SkeletonText noOfLines={2} width="100%" />
          <SkeletonText noOfLines={1} width="50%" />
          <SkeletonText noOfLines={1} width="40%" />
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}
