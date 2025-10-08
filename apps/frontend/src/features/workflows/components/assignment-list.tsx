import { Box, HStack, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/gentasks";
import { useState } from "react";
import { LuEllipsisVertical, LuPencil, LuTrash } from "react-icons/lu";
import { AssignmentDialog } from "./assignment-dialog";
import { DeleteAssignmentDialog } from "./delete-assignment-dialog";

export interface AssignmentItemView {
  id: string;
  scopeKind: "default" | "scenario" | "character" | "participant";
  workflowTask: TaskKind;
  workflowId: string;
  scenarioId?: string | null;
  characterId?: string | null;
  participantId?: string | null;
  workflow?: { name: string };
}

export function AssignmentItem({ item }: { item: AssignmentItemView }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <Box layerStyle="surface" borderRadius="md" p={3} mb={3}>
        <HStack justify="space-between">
          <Text>
            {item.scopeKind} · {item.workflowTask}
          </Text>
          <HStack gap={3}>
            <Text>{item.workflow?.name ?? "(unknown workflow)"}</Text>
            <Menu.Root positioning={{ placement: "bottom-end" }}>
              <Menu.Trigger asChild>
                <IconButton size="sm" variant="ghost">
                  <LuEllipsisVertical />
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.Item value="edit" onClick={() => setEditOpen(true)}>
                      <LuPencil />
                      Edit
                    </Menu.Item>
                    <Menu.Item
                      color="fg.error"
                      _hover={{ bg: "bg.error", color: "fg.error" }}
                      value="delete"
                      onClick={() => setOpen(true)}
                    >
                      <LuTrash />
                      Delete
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </HStack>
        </HStack>
      </Box>
      <DeleteAssignmentDialog
        id={item.id}
        label={item.workflow?.name}
        isOpen={open}
        onOpenChange={setOpen}
      />
      <AssignmentDialog
        isOpen={editOpen}
        onOpenChange={setEditOpen}
        isEditMode
        initialAssignment={{
          workflowId: item.workflowId,
          task: item.workflowTask,
          scopeKind: item.scopeKind,
          scenarioId: item.scenarioId ?? undefined,
          characterId: item.characterId ?? undefined,
          participantId: item.participantId ?? undefined,
        }}
      />
    </>
  );
}
