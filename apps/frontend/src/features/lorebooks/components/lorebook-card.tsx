import { Card, HStack, IconButton, Menu, Portal, Stack, Text, VStack } from "@chakra-ui/react";
import type { LorebookSummary } from "@storyforge/contracts";
import { LuEllipsisVertical, LuPencilLine, LuTrash } from "react-icons/lu";
import { nonBubblingHandler } from "@/lib/non-bubbling-handler";
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
      <Card.Root
        layerStyle="surface"
        _hover={{ layerStyle: "interactive", shadow: "md" }}
        onClick={actions.handleEdit}
      >
        <Card.Body p={4}>
          <VStack align="stretch" gap={3}>
            <HStack justify="space-between">
              <Text fontWeight="medium" truncate>
                {lorebook.name}
              </Text>
              <Menu.Root positioning={{ placement: "bottom-end" }}>
                <Menu.Trigger asChild>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    onClick={(event) => event.stopPropagation()}
                    aria-label="Lorebook actions"
                  >
                    <LuEllipsisVertical />
                  </IconButton>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      <Menu.Item value="edit" onClick={nonBubblingHandler(actions.handleEdit)}>
                        <LuPencilLine />
                        Edit
                      </Menu.Item>
                      <Menu.Item
                        value="delete"
                        color="red.500"
                        onClick={nonBubblingHandler(actions.openDeleteDialog)}
                      >
                        <LuTrash />
                        Delete
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            </HStack>

            <Stack gap={1} fontSize="sm" color="content.muted">
              {lorebook.description && <Text lineClamp={2}>{lorebook.description}</Text>}
              <Text>Entries: {lorebook.entryCount}</Text>
              <Text>Updated {updatedLabel}</Text>
            </Stack>
          </VStack>
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
    <Card.Root layerStyle="surface">
      <Card.Body p={4}>
        <VStack align="stretch" gap={3}>
          <HStack justify="space-between">
            <Stack gap={2}>
              <Text>&nbsp;</Text>
            </Stack>
            <IconButton variant="ghost" size="sm" disabled aria-label="Loading" />
          </HStack>
          <Stack gap={1}>
            <Text>&nbsp;</Text>
            <Text>&nbsp;</Text>
          </Stack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}
