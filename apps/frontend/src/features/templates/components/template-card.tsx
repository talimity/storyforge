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
  Skeleton,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/gentasks";
import { LuCopy, LuEllipsisVertical, LuPencilLine, LuShare, LuTrash } from "react-icons/lu";
import { Link } from "react-router-dom";
import { TemplateDeleteDialog } from "@/features/templates/components/template-delete-dialog";
import { TemplateDuplicateDialog } from "@/features/templates/components/template-duplicate-dialog";
import { useTemplateActions } from "@/features/templates/hooks/use-template-actions";

interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    task: TaskKind;
    version: number;
    layoutNodeCount: number;
    updatedAt: Date;
  };
}

const taskTypeConfig = {
  turn_generation: {
    label: "Turn Generation",
  },
  chapter_summarization: {
    label: "Chapter Summary",
  },
  writing_assistant: {
    label: "Writing Assistant",
  },
};

export function TemplateCard({ template }: TemplateCardProps) {
  const taskConfig = taskTypeConfig[template.task];
  const {
    isDeleteDialogOpen,
    isDuplicateDialogOpen,
    deleteTemplateMutation,
    duplicateTemplateMutation,
    handleDelete,
    handleDuplicate,
    handleExport,
    openDeleteDialog,
    closeDeleteDialog,
    openDuplicateDialog,
    closeDuplicateDialog,
  } = useTemplateActions(template.id);

  const formatUpdatedAt = (date: Date) => {
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <Card.Root size="sm" layerStyle="surface">
        <Card.Header>
          <HStack justify="space-between" align="center">
            <Heading size="md" truncate>
              {/* Template Name */}
              <LinkOverlay asChild>
                <Link to={`/templates/${template.id}/edit`}>{template.name}</Link>
              </LinkOverlay>
            </Heading>

            {/* Overflow Menu */}
            <Menu.Root positioning={{ placement: "bottom-end" }}>
              <Menu.Trigger asChild>
                <IconButton
                  aria-label="Template actions"
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
                      <Link to={`/templates/${template.id}/edit`}>
                        <LuPencilLine />
                        <Box flex="1">Edit</Box>
                      </Link>
                    </Menu.Item>
                    <Menu.Item value="duplicate" onSelect={openDuplicateDialog}>
                      <LuCopy />
                      <Box flex="1">Duplicate</Box>
                    </Menu.Item>
                    <Menu.Item value="export" onSelect={handleExport}>
                      <LuShare />
                      <Box flex="1">Export</Box>
                    </Menu.Item>
                    <Menu.Item
                      value="delete"
                      color="fg.error"
                      _hover={{ bg: "bg.error", color: "fg.error" }}
                      onSelect={openDeleteDialog}
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

        <Card.Body>
          <VStack align="stretch" gap={3}>
            {/* Task Type Badge */}
            <HStack justify="space-between">
              <Badge variant="subtle" size="sm">
                {taskConfig.label}
              </Badge>
              <Text fontSize="xs" color="content.muted">
                v{template.version}
              </Text>
            </HStack>

            {/* Template Stats */}
            <Stack gap={2}>
              <HStack justify="space-between" fontSize="xs" color="content.muted">
                <Text>Layout nodes:</Text>
                <Text fontWeight="medium">{template.layoutNodeCount}</Text>
              </HStack>
              <Text fontSize="xs" color="content.subtle">
                Updated {formatUpdatedAt(template.updatedAt)}
              </Text>
            </Stack>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Dialogs */}
      <TemplateDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={({ open }) => {
          if (!open) {
            closeDeleteDialog();
          }
        }}
        templateName={template.name}
        onConfirmDelete={handleDelete}
        isDeleting={deleteTemplateMutation.isPending}
      />
      <TemplateDuplicateDialog
        isOpen={isDuplicateDialogOpen}
        onOpenChange={({ open }) => {
          if (!open) {
            closeDuplicateDialog();
          }
        }}
        originalName={template.name}
        onConfirmDuplicate={handleDuplicate}
        isDuplicating={duplicateTemplateMutation.isPending}
      />
    </>
  );
}

export function TemplateCardSkeleton() {
  return (
    <Card.Root size="sm" variant="outline">
      <Card.Header>
        <Heading size="lg">
          <Skeleton w="60%" h="8" rounded="md" />
        </Heading>
      </Card.Header>
      <Card.Body>
        <VStack align="start" gap={4}>
          <Skeleton w="40%" h="4" rounded="md" />
          <Skeleton w="30%" h="4" rounded="md" />
          <Skeleton w="50%" h="3" rounded="md" />
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}
