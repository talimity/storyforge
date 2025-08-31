import {
  Badge,
  Box,
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
import {
  LuCopy,
  LuDownload,
  LuEllipsisVertical,
  LuFileText,
  LuPencilLine,
  LuTrash,
} from "react-icons/lu";
import { TemplateDeleteDialog } from "@/components/dialogs/template-delete";
import { TemplateDuplicateDialog } from "@/components/dialogs/template-duplicate";
import { useTemplateActions } from "@/components/features/templates/use-template-actions";

interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    task: TaskKind;
    version: number;
    layoutNodeCount: number;
    updatedAt: Date;
  };
  readOnly?: boolean;
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

export function TemplateCard({
  template,
  readOnly = false,
}: TemplateCardProps) {
  const taskConfig = taskTypeConfig[template.task];
  const {
    isDeleteDialogOpen,
    isDuplicateDialogOpen,
    deleteTemplateMutation,
    duplicateTemplateMutation,
    handleDelete,
    handleEdit,
    handleDuplicate,
    handleExport,
    openDeleteDialog,
    closeDeleteDialog,
    openDuplicateDialog,
    closeDuplicateDialog,
  } = useTemplateActions(template.id);

  const formatUpdatedAt = (date: Date) => {
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <Card.Root
        width={{ base: "100%", sm: "280px" }}
        maxW="280px"
        layerStyle="surface"
        _hover={
          !readOnly ? { layerStyle: "interactive", shadow: "md" } : undefined
        }
        className={readOnly ? undefined : "group"}
        cursor={!readOnly ? "pointer" : "default"}
        onClick={readOnly ? undefined : () => handleEdit()}
        overflow="hidden"
      >
        <Box position="relative">
          {/* Template Icon Header */}
          <Box
            bg="surface.muted"
            display="flex"
            alignItems="center"
            justifyContent="center"
            height="120px"
            color="content.muted"
          >
            <LuFileText size={48} />
          </Box>

          {/* Options Menu */}
          {!readOnly && (
            <Menu.Root positioning={{ placement: "bottom-end" }}>
              <Menu.Trigger asChild>
                <IconButton
                  aria-label="Template options"
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
                  <LuEllipsisVertical />
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.Item
                      value="edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit();
                      }}
                    >
                      <LuPencilLine />
                      <Box flex="1">Edit</Box>
                    </Menu.Item>
                    <Menu.Item
                      value="duplicate"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDuplicateDialog();
                      }}
                    >
                      <LuCopy />
                      <Box flex="1">Duplicate</Box>
                    </Menu.Item>
                    <Menu.Item
                      value="export"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport();
                      }}
                    >
                      <LuDownload />
                      <Box flex="1">Export</Box>
                    </Menu.Item>
                    <Menu.Item
                      value="delete"
                      color="fg.error"
                      _hover={{ bg: "bg.error", color: "fg.error" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteDialog();
                      }}
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

        <Card.Body p={4}>
          <VStack align="stretch" gap={3}>
            {/* Template Name */}
            <Text fontWeight="semibold" fontSize="md" lineClamp={2}>
              {template.name}
            </Text>

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
              <HStack
                justify="space-between"
                fontSize="xs"
                color="content.muted"
              >
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
      {!readOnly && (
        <>
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
      )}
    </>
  );
}
