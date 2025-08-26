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
import type { TaskKind } from "@storyforge/prompt-renderer";
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
import { useTemplateActions } from "./use-template-actions";

interface TemplateListItemProps {
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

export function TemplateListItem({
  template,
  readOnly = false,
}: TemplateListItemProps) {
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
    <Card.Root
      layerStyle="surface"
      _hover={
        !readOnly ? { layerStyle: "interactive", shadow: "sm" } : undefined
      }
      className={readOnly ? undefined : "group"}
      cursor={!readOnly ? "pointer" : "default"}
      onClick={readOnly ? undefined : handleEdit}
    >
      <Card.Body p={4}>
        <Stack
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{ base: "stretch", md: "center" }}
          gap={4}
        >
          {/* Left side - Icon and Template Info */}
          <HStack gap={4} flex="1" minW="0">
            {/* Template Icon */}
            <Box
              bg="surface.muted"
              p={3}
              borderRadius="md"
              color="content.muted"
              flexShrink={0}
              display={{ base: "none", sm: "block" }}
            >
              <LuFileText size={24} />
            </Box>

            {/* Template Details */}
            <VStack align="start" gap={1} flex="1" minW="0">
              <Text fontWeight="semibold" fontSize="md" lineClamp={1}>
                {template.name}
              </Text>
              <HStack gap={4} wrap="wrap">
                <Badge variant="subtle" size="sm">
                  {taskConfig.label}
                </Badge>
                <Text fontSize="sm" color="content.muted">
                  v{template.version}
                </Text>
                <Text fontSize="sm" color="content.muted">
                  {template.layoutNodeCount} nodes
                </Text>
              </HStack>
            </VStack>
          </HStack>

          {/* Right side - Last modified and actions */}
          <HStack
            gap={4}
            flexShrink={0}
            justify={{ base: "space-between", md: "flex-end" }}
          >
            <Text
              fontSize="sm"
              color="content.subtle"
              minW={{ base: "auto", md: "100px" }}
              textAlign={{ base: "left", md: "right" }}
            >
              {formatUpdatedAt(template.updatedAt)}
            </Text>

            {/* Quick Actions */}
            {!readOnly && (
              <HStack gap={1}>
                <IconButton
                  aria-label="Edit template"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit();
                  }}
                  opacity={0}
                  _groupHover={{ opacity: 1 }}
                  _focus={{ opacity: 1 }}
                >
                  <LuPencilLine />
                </IconButton>

                <IconButton
                  aria-label="Duplicate template"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDuplicateDialog();
                  }}
                  opacity={0}
                  _groupHover={{ opacity: 1 }}
                  _focus={{ opacity: 1 }}
                >
                  <LuCopy />
                </IconButton>

                <Menu.Root positioning={{ placement: "bottom-end" }}>
                  <Menu.Trigger asChild>
                    <IconButton
                      aria-label="More options"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => e.stopPropagation()}
                      opacity={0}
                      _groupHover={{ opacity: 1 }}
                      _focus={{ opacity: 1 }}
                    >
                      <LuEllipsisVertical />
                    </IconButton>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner>
                      <Menu.Content>
                        <Menu.Item value="edit" onClick={handleEdit}>
                          <LuPencilLine />
                          <Box flex="1">Edit</Box>
                        </Menu.Item>
                        <Menu.Item
                          value="duplicate"
                          onClick={openDuplicateDialog}
                        >
                          <LuCopy />
                          <Box flex="1">Duplicate</Box>
                        </Menu.Item>
                        <Menu.Item value="export" onClick={handleExport}>
                          <LuDownload />
                          <Box flex="1">Export</Box>
                        </Menu.Item>
                        <Menu.Item
                          value="delete"
                          color="fg.error"
                          _hover={{ bg: "bg.error", color: "fg.error" }}
                          onClick={openDeleteDialog}
                        >
                          <LuTrash />
                          <Box flex="1">Delete</Box>
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              </HStack>
            )}
          </HStack>
        </Stack>
      </Card.Body>

      {/* Dialogs */}
      {!readOnly && (
        <>
          <TemplateDeleteDialog
            isOpen={isDeleteDialogOpen}
            onOpenChange={({ open }) =>
              open ? undefined : closeDeleteDialog()
            }
            templateName={template.name}
            onConfirmDelete={handleDelete}
            isDeleting={deleteTemplateMutation.isPending}
          />
          <TemplateDuplicateDialog
            isOpen={isDuplicateDialogOpen}
            onOpenChange={({ open }) =>
              open ? undefined : closeDuplicateDialog()
            }
            originalName={template.name}
            onConfirmDuplicate={handleDuplicate}
            isDuplicating={duplicateTemplateMutation.isPending}
          />
        </>
      )}
    </Card.Root>
  );
}
