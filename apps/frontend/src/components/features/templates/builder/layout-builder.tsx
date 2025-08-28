import {
  Box,
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  ChatCompletionMessageRole,
  TaskKind,
} from "@storyforge/prompt-rendering";
import { LuLayers, LuMessageSquare, LuPlus } from "react-icons/lu";
import { LayoutNodeCard } from "@/components/features/templates/builder/layout-node-card";
import { useLayoutDnd } from "@/components/features/templates/builder/use-layout-dnd";
import { getRecipesForTask } from "@/components/features/templates/recipes/registry";
import type { LayoutNodeDraft } from "@/components/features/templates/types";
import { Button, EmptyState } from "@/components/ui";
import {
  getMissingSlots,
  useTemplateBuilderStore,
} from "@/stores/template-builder-store";

interface LayoutBuilderProps {
  task?: TaskKind;
}

export function LayoutBuilder({ task }: LayoutBuilderProps) {
  const {
    layoutDraft: layout,
    addMessageNode,
    createSlotFromRecipe,
    reorderNodes,
    deleteNode,
  } = useTemplateBuilderStore();

  const store = useTemplateBuilderStore();
  const missingSlots = getMissingSlots(store);
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

  const handleAddMessage = (role: ChatCompletionMessageRole) => {
    addMessageNode(role);
  };

  const handleCreateSlotFromRecipe = (recipeId: string) => {
    if (!task) return;
    createSlotFromRecipe(recipeId);
  };

  const handleDeleteNode = (nodeId: string) => {
    deleteNode(nodeId, true); // true = cleanup orphaned slots
  };

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
                title="No layout elements"
                description="Add messages, slot references, or separators to build your template structure."
                icon={<LuLayers />}
              />
            ) : (
              layout.map((node) => (
                <SortableLayoutNode
                  key={node.id}
                  node={node}
                  task={task}
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
          <MenuItem
            value="system-message"
            onClick={() => handleAddMessage("system")}
          >
            <LuMessageSquare />
            System Message
          </MenuItem>
          <MenuItem
            value="user-message"
            onClick={() => handleAddMessage("user")}
          >
            <LuMessageSquare />
            User Message
          </MenuItem>
          <MenuItem
            value="assistant-message"
            onClick={() => handleAddMessage("assistant")}
          >
            <LuMessageSquare />
            Assistant Message
          </MenuItem>

          <Separator />

          {/* Recipes */}
          {taskRecipes.map((recipe) => (
            <MenuItem
              key={recipe.id}
              value={`recipe-${recipe.id}`}
              onClick={() => handleCreateSlotFromRecipe(recipe.id)}
            >
              <LuLayers />
              {recipe.name}
            </MenuItem>
          ))}
          <Separator />

          <MenuItem
            key="custom-slot"
            value="custom-slot"
            onClick={() => handleCreateSlotFromRecipe("custom")}
          >
            <LuLayers />
            Custom Content Slot
          </MenuItem>
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
  task?: TaskKind;
  onDelete: (nodeId: string) => void;
}

function SortableLayoutNode({ node, task, onDelete }: SortableLayoutNodeProps) {
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
      task={task}
      isDragging={isDragging}
      onDelete={onDelete}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}
