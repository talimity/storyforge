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
} from "@storyforge/prompt-renderer";
import { LuLayers, LuMessageSquare, LuMinus, LuPlus } from "react-icons/lu";
import { Button, EmptyState } from "@/components/ui";
import { getRecipesForTask } from "../recipes/registry";
import type { LayoutNodeDraft, SlotDraft, SlotRecipeId } from "../types";
import {
  generateNodeId,
  getDefaultMessageContent,
  validateSlotReferences,
} from "./builder-utils";
import { LayoutNodeCard } from "./layout-node-card";
import { useLayoutDnd } from "./use-layout-dnd";

interface LayoutBuilderProps {
  layout: LayoutNodeDraft[];
  slots: Record<string, SlotDraft>;
  onLayoutChange: (layout: LayoutNodeDraft[]) => void;
  task?: TaskKind;
  onSlotsChange?: (slots: Record<string, SlotDraft>) => void;
}

export function LayoutBuilder({
  layout,
  slots,
  onLayoutChange,
  task,
  onSlotsChange,
}: LayoutBuilderProps) {
  const {
    activeNode,
    dndContextProps,
    sortableContextProps,
    DragOverlayComponent,
  } = useLayoutDnd({
    layout,
    onLayoutChange,
  });

  const handleAddMessage = (role: ChatCompletionMessageRole) => {
    const newNode: LayoutNodeDraft = {
      id: generateNodeId(),
      kind: "message",
      role,
      content: getDefaultMessageContent(role),
    };

    onLayoutChange([...layout, newNode]);
  };

  const handleAddSlotReference = (slotName: string) => {
    const newNode: LayoutNodeDraft = {
      id: generateNodeId(),
      kind: "slot",
      name: slotName,
      omitIfEmpty: true,
    };

    onLayoutChange([...layout, newNode]);
  };

  const handleAddSeparator = () => {
    const newNode: LayoutNodeDraft = {
      id: generateNodeId(),
      kind: "separator",
      text: "---",
    };

    onLayoutChange([...layout, newNode]);
  };

  const handleDeleteNode = (nodeId: string) => {
    // Find the node being deleted
    const nodeToDelete = layout.find((node) => node.id === nodeId);

    // Filter out the deleted node
    const updatedLayout = layout.filter((node) => node.id !== nodeId);
    onLayoutChange(updatedLayout);

    // If we deleted a slot reference, check if we need to clean up the slot
    if (nodeToDelete?.kind === "slot" && onSlotsChange) {
      const slotName = nodeToDelete.name;

      // Check if any remaining layout nodes still reference this slot
      const hasRemainingReferences = updatedLayout.some(
        (node) => node.kind === "slot" && node.name === slotName
      );

      // If no remaining references, remove the slot from slots object
      if (!hasRemainingReferences && slots[slotName]) {
        const updatedSlots = { ...slots };
        delete updatedSlots[slotName];
        onSlotsChange(updatedSlots);
      }
    }
  };

  const handleNodeChange = (updatedNode: LayoutNodeDraft) => {
    const updatedLayout = layout.map((node) =>
      node.id === updatedNode.id ? updatedNode : node
    );
    onLayoutChange(updatedLayout);
  };

  const handleSlotChange = (updatedSlot: SlotDraft) => {
    if (!onSlotsChange) return;
    const updatedSlots = { ...slots, [updatedSlot.name]: updatedSlot };
    onSlotsChange(updatedSlots);
  };

  const { missingSlots } = validateSlotReferences(layout, slots);
  const taskRecipes = task ? getRecipesForTask(task) : [];
  const availableRecipes = taskRecipes.filter(
    (r) => !Object.values(slots).some((s) => s.recipeId === r.id)
  );

  const handleCreateSlotFromRecipe = (recipeId: string) => {
    if (!task || !onSlotsChange) return;

    const recipe = taskRecipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    const slotName = recipe.name.toLowerCase().replace(/\s+/g, "_");
    const existingSlot = slots[slotName];

    if (existingSlot) {
      // If slot already exists, just add a reference to it
      handleAddSlotReference(slotName);
      return;
    }

    // Create new slot
    const newSlot: SlotDraft = {
      recipeId: recipe.id as SlotRecipeId,
      name: slotName,
      priority: Object.keys(slots).length,
      params: {},
    };

    const updatedSlots = { ...slots, [slotName]: newSlot };
    onSlotsChange(updatedSlots);

    // Also add a reference to the layout
    handleAddSlotReference(slotName);
  };

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
                  slots={slots}
                  task={task}
                  isSelected={false}
                  onNodeChange={handleNodeChange}
                  onSlotChange={handleSlotChange}
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
          {availableRecipes.length > 0 && (
            <>
              {availableRecipes.map((recipe) => (
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
            </>
          )}

          <Separator />

          {/* Separator */}
          <MenuItem value="separator" onClick={handleAddSeparator}>
            <LuMinus />
            Separator
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
  slots: Record<string, SlotDraft>;
  task?: TaskKind;
  isSelected: boolean;
  onNodeChange: (node: LayoutNodeDraft) => void;
  onSlotChange: (slot: SlotDraft) => void;
  onDelete: (nodeId: string) => void;
}

function SortableLayoutNode({
  node,
  slots,
  task,
  isSelected,
  onNodeChange,
  onSlotChange,
  onDelete,
}: SortableLayoutNodeProps) {
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
      slots={slots}
      task={task}
      isSelected={isSelected}
      isDragging={isDragging}
      onNodeChange={onNodeChange}
      onSlotChange={onSlotChange}
      onDelete={onDelete}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}
