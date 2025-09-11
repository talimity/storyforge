import {
  Badge,
  Card,
  HStack,
  IconButton,
  Menu,
  Portal,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/gentasks";
import { LuCopy, LuEllipsisVertical, LuPencilLine, LuShare, LuTrash } from "react-icons/lu";
import { useWorkflowActions } from "../hooks/use-workflow-actions";
import { DeleteWorkflowDialog } from "./delete-workflow-dialog";
import { WorkflowDuplicateDialog } from "./workflow-duplicate-dialog";

export interface WorkflowSummaryView {
  id: string;
  name: string;
  task: TaskKind;
  version: number;
  stepCount: number;
  isBuiltIn: boolean;
  updatedAt: Date;
}

export function WorkflowCard({ workflow }: { workflow: WorkflowSummaryView }) {
  const actions = useWorkflowActions(workflow.id);

  return (
    <>
      <Card.Root layerStyle="surface">
        <Card.Body p={4}>
          <VStack align="stretch" gap={3}>
            <HStack justify="space-between">
              <HStack gap={2}>
                <Text fontWeight="medium" truncate>
                  {workflow.name}
                </Text>
                {workflow.isBuiltIn && (
                  <Badge colorPalette="gray" size="xs">
                    Built-in
                  </Badge>
                )}
              </HStack>
              <Menu.Root positioning={{ placement: "bottom-end" }}>
                <Menu.Trigger asChild>
                  <IconButton variant="ghost" size="sm">
                    <LuEllipsisVertical />
                  </IconButton>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      <Menu.Item value="edit" onClick={actions.handleEdit}>
                        <LuPencilLine />
                        Edit
                      </Menu.Item>
                      <Menu.Item value="duplicate" onClick={actions.openDuplicateDialog}>
                        <LuCopy />
                        Duplicate
                      </Menu.Item>
                      <Menu.Item value="export" onClick={actions.handleExport}>
                        <LuShare />
                        Export
                      </Menu.Item>
                      <Menu.Item value="delete" onClick={actions.openDeleteDialog} color="red.500">
                        <LuTrash />
                        Delete
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            </HStack>

            <VStack align="stretch" gap={1}>
              <Text fontSize="sm" color="content.muted" truncate>
                Task: {workflow.task}
              </Text>
              <Text fontSize="sm" color="content.muted" truncate>
                Steps: {workflow.stepCount}
              </Text>
              <Text color="fg.subtle" fontSize="xs">
                Updated {new Date(workflow.updatedAt).toLocaleString()}
              </Text>
            </VStack>
          </VStack>
        </Card.Body>
      </Card.Root>
      <DeleteWorkflowDialog
        workflow={{ id: workflow.id, name: workflow.name }}
        isOpen={actions.isDeleteDialogOpen}
        onOpenChange={(open) => (open ? actions.openDeleteDialog() : actions.closeDeleteDialog())}
      />
      <WorkflowDuplicateDialog
        isOpen={actions.isDuplicateDialogOpen}
        onOpenChange={(open) =>
          open ? actions.openDuplicateDialog() : actions.closeDuplicateDialog()
        }
        originalName={workflow.name}
        onConfirmDuplicate={actions.handleDuplicate}
        isDuplicating={actions.duplicateWorkflowMutation.isPending}
      />
    </>
  );
}

export function WorkflowCardSkeleton() {
  return (
    <Card.Root layerStyle="surface">
      <Card.Body p={4}>
        <VStack align="stretch" gap={3}>
          <HStack justify="space-between">
            <Stack gap={2}>
              <Text>&nbsp;</Text>
            </Stack>
            <IconButton variant="ghost" size="sm" disabled>
              <LuEllipsisVertical />
            </IconButton>
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
