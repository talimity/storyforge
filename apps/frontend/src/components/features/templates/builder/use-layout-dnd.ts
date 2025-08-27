import {
  closestCenter,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useMemo, useState } from "react";
import type { LayoutNodeDraft } from "@/components/features/templates/types";

interface UseLayoutDndProps {
  layout: LayoutNodeDraft[];
  onLayoutChange: (newLayout: LayoutNodeDraft[]) => void;
}

interface UseLayoutDndReturn {
  activeNode: LayoutNodeDraft | null;
  sensors: ReturnType<typeof useSensors>;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  dndContextProps: {
    sensors: ReturnType<typeof useSensors>;
    collisionDetection: typeof closestCenter;
    onDragStart: (event: DragStartEvent) => void;
    onDragEnd: (event: DragEndEvent) => void;
  };
  sortableContextProps: {
    items: string[];
    strategy: typeof verticalListSortingStrategy;
  };
  DragOverlayComponent: React.ComponentType<{
    children: React.ReactNode;
  }>;
}

/**
 * Provides drag and drop functionality for layout nodes
 */
export function useLayoutDnd({
  layout,
  onLayoutChange,
}: UseLayoutDndProps): UseLayoutDndReturn {
  const [activeNode, setActiveNode] = useState<LayoutNodeDraft | null>(null);

  // Configure sensors for drag detection
  // PointerSensor with activation distance to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required to start drag
      },
    })
  );

  // Get sortable items (node IDs) for dnd-kit
  const sortableItems = useMemo(() => layout.map((node) => node.id), [layout]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const node = layout.find((n) => n.id === active.id);
    setActiveNode(node || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = layout.findIndex((node) => node.id === active.id);
      const newIndex = layout.findIndex((node) => node.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newLayout = arrayMove(layout, oldIndex, newIndex);
        onLayoutChange(newLayout);
      }
    }

    setActiveNode(null);
  };

  // Pre-configured props for DndContext and SortableContext
  const dndContextProps = {
    sensors,
    collisionDetection: closestCenter,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
  };

  const sortableContextProps = {
    items: sortableItems,
    strategy: verticalListSortingStrategy,
  };

  // DragOverlay component wrapper
  const DragOverlayComponent = DragOverlay;

  return {
    activeNode,
    sensors,
    handleDragStart,
    handleDragEnd,
    dndContextProps,
    sortableContextProps,
    DragOverlayComponent,
  };
}

/**
 * Helper hook for individual sortable items
 * Provides the necessary props for sortable elements
 */
export function useSortableNode(id: string, isDragging?: boolean) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || sortableIsDragging ? 0.5 : 1,
  };

  return {
    ref: setNodeRef,
    style,
    dragHandleProps: {
      ...attributes,
      ...listeners,
    },
    isDragging: isDragging || sortableIsDragging,
  };
}

// Import dependencies for the sortable hook
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
