import { Box, HStack, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import { useState } from "react";
import { LuEllipsisVertical, LuTrash } from "react-icons/lu";
import { DeleteAssignmentDialog } from "./delete-assignment-dialog";

export interface AssignmentItemView {
  id: string;
  scopeKind: string;
  workflowTask: string;
  workflow?: { name: string };
}

export function AssignmentList({ items }: { items: AssignmentItemView[] }) {
  return (
    <Box>
      {items.map((a) => (
        <AssignmentItem key={a.id} item={a} />
      ))}
    </Box>
  );
}

function AssignmentItem({ item }: { item: AssignmentItemView }) {
  const [open, setOpen] = useState(false);
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
                    <Menu.Item
                      value="delete"
                      onClick={() => setOpen(true)}
                      color="red.500"
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
    </>
  );
}
