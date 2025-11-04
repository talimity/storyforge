import {
  List,
  MenuContent,
  MenuItem,
  MenuItemGroup,
  MenuItemGroupLabel,
  MenuPositioner,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
  Portal,
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
  LuTriangleAlert,
} from "react-icons/lu";
import { useShallow } from "zustand/react/shallow";
import { Alert, Button, EmptyState } from "@/components/ui";
import { LayoutNodeCard } from "@/features/template-builder/components/layout-node-card";
import { useLayoutDnd } from "@/features/template-builder/hooks/use-layout-dnd";
import { getRecipesForTask } from "@/features/template-builder/services/recipe-registry";
import {
  getMissingSlots,
  useTemplateBuilderStore,
} from "@/features/template-builder/stores/template-builder-store";
import type { AnyRecipeId, LayoutNodeDraft } from "@/features/template-builder/types";

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
  const missingSlots = useTemplateBuilderStore(useShallow((s) => getMissingSlots(s)));

  const { activeNode, dndContextProps, sortableContextProps, DragOverlayComponent } = useLayoutDnd({
    layout,
    reorderNodes,
  });

  const handleDeleteNode = useCallback((id: string) => deleteNode(id, true), [deleteNode]);
  const handleAddMessage = useCallback(
    (role: ChatCompletionMessageRole, index?: number) => addMessageNode(role, index),
    [addMessageNode]
  );
  const handleCreateSlotFromRecipe = useCallback(
    (id: AnyRecipeId | "custom", index?: number) =>
      task ? createSlotFromRecipe(id, undefined, index) : undefined,
    [task, createSlotFromRecipe]
  );

  return (
    <VStack align="stretch" gap={4}>
      {/* Validation Warnings */}
      {missingSlots.length > 0 && (
        <Alert
          icon={<LuTriangleAlert />}
          title={`Missing slots referenced in layout`}
          status="error"
        >
          <List.Root>
            {missingSlots.map((error, index) => (
              <List.Item key={error + String(index)}>{error}</List.Item>
            ))}
          </List.Root>
        </Alert>
      )}

      <AddElementMenu
        task={task}
        insertionIndex={0}
        onAddMessage={handleAddMessage}
        onCreateSlotFromRecipe={handleCreateSlotFromRecipe}
      />

      {/* Layout Nodes */}
      <DndContext {...dndContextProps}>
        <SortableContext {...sortableContextProps}>
          <VStack align="stretch" gap={2}>
            {layout.length === 0 ? (
              <EmptyState
                title="No layout elements yet"
                description="Add blocks to your prompt layout using the Add Element menu."
                icon={<LuLayers />}
              />
            ) : (
              layout.map((node) => (
                <SortableLayoutNode key={node.id} node={node} onDelete={handleDeleteNode} />
              ))
            )}
          </VStack>
        </SortableContext>

        <DragOverlayComponent>
          {activeNode ? (
            <LayoutNodeCard node={activeNode} isDragging style={{ cursor: "grabbing" }} />
          ) : null}
        </DragOverlayComponent>
      </DndContext>

      {layout.length > 2 && (
        <AddElementMenu
          task={task}
          onAddMessage={handleAddMessage}
          onCreateSlotFromRecipe={handleCreateSlotFromRecipe}
        />
      )}
    </VStack>
  );
}

type AddElementMenuProps = {
  task?: TaskKind;
  insertionIndex?: number;
  onAddMessage: (role: ChatCompletionMessageRole, index?: number) => void;
  onCreateSlotFromRecipe: (id: AnyRecipeId | "custom", index?: number) => void;
};

function AddElementMenu(props: AddElementMenuProps) {
  const { task, onAddMessage, onCreateSlotFromRecipe, insertionIndex } = props;

  const taskRecipes = task ? getRecipesForTask(task) : [];

  return (
    <MenuRoot positioning={{ sameWidth: true, fitViewport: true }}>
      <MenuTrigger asChild>
        <Button variant="outline" colorPalette="primary" w="full">
          <LuPlus />
          Add Element
        </Button>
      </MenuTrigger>
      <Portal>
        <MenuPositioner>
          <MenuContent>
            {/* Message Options */}
            <MenuItemGroup>
              <MenuItemGroupLabel>Messages</MenuItemGroupLabel>
              <MenuItem
                value="system-message"
                onClick={() => onAddMessage("system", insertionIndex)}
              >
                <LuMessageSquareCode />
                System Message
              </MenuItem>
              <MenuItem value="user-message" onClick={() => onAddMessage("user", insertionIndex)}>
                <LuMessageSquareMore />
                User Message
              </MenuItem>
              <MenuItem
                value="assistant-message"
                onClick={() => onAddMessage("assistant", insertionIndex)}
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
                  onClick={() => onCreateSlotFromRecipe(recipe.id, insertionIndex)}
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
                onClick={() => onCreateSlotFromRecipe("custom", insertionIndex)}
              >
                <LuLayers />
                Custom Block (Advanced)
              </MenuItem>
            </MenuItemGroup>
          </MenuContent>
        </MenuPositioner>
      </Portal>
    </MenuRoot>
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <LayoutNodeCard
      containerRef={setNodeRef}
      style={style}
      node={node}
      isDragging={isDragging}
      onDelete={onDelete}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}
