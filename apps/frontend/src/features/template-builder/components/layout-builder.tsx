import {
  Box,
  MenuContent,
  MenuItem,
  MenuItemGroup,
  MenuItemGroupLabel,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskKind } from "@storyforge/gentasks";
import type { ChatCompletionMessageRole } from "@storyforge/prompt-rendering";
import { useCallback } from "react";
import {
  LuBotMessageSquare,
  LuLayers,
  LuMessageSquareCode,
  LuMessageSquareMore,
  LuPlus,
} from "react-icons/lu";
import { useShallow } from "zustand/react/shallow";
import { Button, EmptyState } from "@/components/ui/index";
import { LayoutNodeCard } from "@/features/template-builder/components/layout-node-card";
import { useLayoutDnd } from "@/features/template-builder/hooks/use-layout-dnd";
import { getRecipesForTask } from "@/features/template-builder/services/recipe-registry";
import {
  getMissingSlots,
  useTemplateBuilderStore,
} from "@/features/template-builder/stores/template-builder-store";
import type {
  AnyRecipeId,
  LayoutNodeDraft,
} from "@/features/template-builder/types";

interface LayoutBuilderProps {
  task?: TaskKind;
}

export function LayoutBuilder({ task }: LayoutBuilderProps) {
  const { addMessageNode, createSlotFromRecipe, reorderNodes, deleteNode } =
    useTemplateBuilderStore(
      useShallow((s) => ({
        addMessageNode: s.addMessageNode,
        createSlotFromRecipe: s.createSlotFromRecipe,
        reorderNodes: s.reorderNodes,
        deleteNode: s.deleteNode,
      }))
    );
  const layout = useTemplateBuilderStore(useShallow((s) => s.layoutDraft));
  const missingSlots = useTemplateBuilderStore(
    useShallow((s) => getMissingSlots(s))
  );

  const {
    activeNode,
    dndContextProps,
    sortableContextProps,
    DragOverlayComponent,
  } = useLayoutDnd({
    layout,
    onLayoutChange: (newLayout) => {
      // Calculate the movements needed
      const oldIndexMap = new Map(layout.map((node, idx) => [node.id, idx]));
      const newIndexMap = new Map(newLayout.map((node, idx) => [node.id, idx]));

      // Find the node that moved
      for (const [nodeId, newIdx] of newIndexMap) {
        const oldIdx = oldIndexMap.get(nodeId);
        if (oldIdx !== undefined && oldIdx !== newIdx) {
          // This node moved from oldIdx to newIdx
          reorderNodes(oldIdx, newIdx);
          break;
        }
      }
    },
  });

  const handleDeleteNode = useCallback(
    (id: string) => deleteNode(id, true),
    [deleteNode]
  );
  const handleAddMessage = useCallback(
    (role: ChatCompletionMessageRole) => addMessageNode(role),
    [addMessageNode]
  );
  const handleCreateSlotFromRecipe = useCallback(
    (id: AnyRecipeId | "custom") => task && createSlotFromRecipe(id),
    [task, createSlotFromRecipe]
  );

  const taskRecipes = task ? getRecipesForTask(task) : [];

  return (
    <VStack align="stretch" gap={4}>
      {/* Validation Warnings */}
      {missingSlots.length > 0 && (
        <Box
          p={3}
          bg="red.50"
          borderColor="red.200"
          borderWidth="1px"
          borderRadius="md"
        >
          <Text fontSize="sm" color="red.700" fontWeight="medium">
            Missing slots referenced in layout:
          </Text>
          <Text fontSize="sm" color="red.600">
            {missingSlots.join(", ")}
          </Text>
        </Box>
      )}

      {/* Layout Nodes */}
      <DndContext {...dndContextProps}>
        <SortableContext {...sortableContextProps}>
          <VStack align="stretch" gap={2}>
            {layout.length === 0 ? (
              <EmptyState
                title="No layout elements yet"
                description="Add blocks to your prompt layout using the menu below."
                icon={<LuLayers />}
              />
            ) : (
              layout.map((node) => (
                <SortableLayoutNode
                  key={node.id}
                  node={node}
                  onDelete={handleDeleteNode}
                />
              ))
            )}
          </VStack>
        </SortableContext>

        <DragOverlayComponent>
          {activeNode ? (
            <LayoutNodeCard
              node={activeNode}
              isDragging
              style={{ cursor: "grabbing" }}
            />
          ) : null}
        </DragOverlayComponent>
      </DndContext>

      {/* Add Element Menu */}
      <MenuRoot>
        <MenuTrigger asChild>
          <Button variant="outline" colorPalette="primary" w="full">
            <LuPlus />
            Add Element
          </Button>
        </MenuTrigger>
        <MenuContent>
          {/* Message Options */}
          <MenuItemGroup>
            <MenuItemGroupLabel>Messages</MenuItemGroupLabel>
            <MenuItem
              value="system-message"
              onClick={() => handleAddMessage("system")}
            >
              <LuMessageSquareCode />
              System Message
            </MenuItem>
            <MenuItem
              value="user-message"
              onClick={() => handleAddMessage("user")}
            >
              <LuMessageSquareMore />
              User Message
            </MenuItem>
            <MenuItem
              value="assistant-message"
              onClick={() => handleAddMessage("assistant")}
            >
              <LuBotMessageSquare />
              Assistant Message
            </MenuItem>
          </MenuItemGroup>
          <MenuSeparator />
          {/* Recipes */}
          <MenuItemGroup>
            <MenuItemGroupLabel>Content Blocks</MenuItemGroupLabel>
            {taskRecipes.map((recipe) => (
              <MenuItem
                key={recipe.id}
                value={`recipe-${recipe.id}`}
                onClick={() => handleCreateSlotFromRecipe(recipe.id)}
              >
                <VStack align="start" gap={1}>
                  <Stack direction="row" align="center" gap={2}>
                    <LuLayers /> {recipe.name}
                  </Stack>
                  <Text fontSize="xs" color="content.muted">
                    {recipe.description}
                  </Text>
                </VStack>
              </MenuItem>
            ))}
            <MenuSeparator />

            <MenuItem
              key="custom-slot"
              value="custom-slot"
              onClick={() => handleCreateSlotFromRecipe("custom")}
            >
              <LuLayers />
              Custom Block (Advanced)
            </MenuItem>
          </MenuItemGroup>
        </MenuContent>
      </MenuRoot>
    </VStack>
  );
}

/**
 * Individual sortable layout node wrapper
 */
interface SortableLayoutNodeProps {
  node: LayoutNodeDraft;
  onDelete: (nodeId: string) => void;
}

function SortableLayoutNode({ node, onDelete }: SortableLayoutNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <LayoutNodeCard
      ref={setNodeRef}
      style={style}
      node={node}
      isDragging={isDragging}
      onDelete={onDelete}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}
