import {
  Badge,
  Box,
  Card,
  Heading,
  HStack,
  IconButton,
  LinkOverlay,
  Menu,
  Portal,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/gentasks";
import { LuCopy, LuEllipsisVertical, LuPencilLine, LuShare, LuTrash } from "react-icons/lu";
import { Link } from "react-router-dom";
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

export function WorkflowCard(props: { workflow: WorkflowSummaryView }) {
  const { workflow } = props;
  const actions = useWorkflowActions(workflow.id);

  return (
    <>
      <Card.Root size="sm" layerStyle="surface" variant="elevated">
        <Card.Header>
          <HStack justify="space-between" align="center">
            <HStack gap={2}>
              <Heading size="md" truncate>
                <LinkOverlay asChild>
                  <Link to={`/workflows/${workflow.id}/edit`}>{workflow.name}</Link>
                </LinkOverlay>
              </Heading>
              {workflow.isBuiltIn && (
                <Badge colorPalette="gray" size="xs">
                  Built-in
                </Badge>
              )}
            </HStack>
            <Menu.Root positioning={{ placement: "bottom-end" }}>
              <Menu.Trigger asChild>
                <IconButton
                  aria-label="Workflow actions"
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
                      <Link to={`/workflows/${workflow.id}/edit`}>
                        <LuPencilLine />
                        <Box flex="1">Edit</Box>
                      </Link>
                    </Menu.Item>
                    <Menu.Item value="duplicate" onSelect={actions.openDuplicateDialog}>
                      <LuCopy />
                      <Box flex="1">Duplicate</Box>
                    </Menu.Item>
                    <Menu.Item value="export" onSelect={actions.handleExport}>
                      <LuShare />
                      <Box flex="1">Export</Box>
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
        </Card.Body>
      </Card.Root>

      {/* Dialogs */}
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

// TODO: fix to use actual skeleton components
export function WorkflowCardSkeleton() {
  return (
    <Card.Root layerStyle="surface">
      <Card.Body p={4}>
        <VStack align="stretch" gap={3}>
          <HStack justify="space-between">
            <Stack gap={2}>
              <Text>&nbsp;</Text>
            </Stack>
            <IconButton variant="ghost" size="xs" disabled>
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
