import { Text } from "@chakra-ui/react";
import { forwardRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { MessageNodeEdit } from "@/components/features/templates/builder/nodes/message-node-edit";
import { MessageNodeView } from "@/components/features/templates/builder/nodes/message-node-view";
import { SlotReferenceEdit } from "@/components/features/templates/builder/nodes/slot-reference-edit";
import { SlotReferenceView } from "@/components/features/templates/builder/nodes/slot-reference-view";
import type {
  LayoutNodeDraft,
  SlotDraft,
} from "@/components/features/templates/types";
import { useTemplateBuilderStore } from "@/stores/template-builder-store";

interface LayoutNodeCardProps {
  node: LayoutNodeDraft;
  isDragging?: boolean;
  onDelete?: (nodeId: string) => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}

export const LayoutNodeCard = forwardRef<HTMLDivElement, LayoutNodeCardProps>(
  (props, ref) => {
    const {
      node,
      isDragging = false,
      onDelete,
      dragHandleProps,
      style,
    } = props;
    const {
      slots,
      editingNodeId,
      startEditingNode,
      saveNodeEdit,
      cancelNodeEdit,
    } = useTemplateBuilderStore(
      useShallow((s) => ({
        slots: s.slotsDraft,
        editingNodeId: s.editingNodeId,
        startEditingNode: s.startEditingNode,
        saveNodeEdit: s.saveNodeEdit,
        cancelNodeEdit: s.cancelNodeEdit,
      }))
    );

    const isEditing = editingNodeId === node.id;

    const handleEdit = () => {
      startEditingNode(node.id);
    };

    const handleSaveNode = (updatedNode: LayoutNodeDraft) => {
      saveNodeEdit(node.id, updatedNode);
    };

    const handleSaveSlot = (
      updatedNode: LayoutNodeDraft,
      updatedSlot: SlotDraft
    ) => {
      saveNodeEdit(node.id, updatedNode, updatedSlot);
    };

    const handleCancel = () => {
      cancelNodeEdit();
    };

    // Get the slot for slot references
    const slot = node.kind === "slot" ? slots[node.name] : undefined;
    const kind = node.kind;

    if (isEditing) {
      // Render edit mode based on node type
      if (kind === "message") {
        return (
          <MessageNodeEdit
            ref={ref}
            style={style}
            node={node}
            isDragging={isDragging}
            onSave={handleSaveNode}
            onCancel={handleCancel}
            dragHandleProps={dragHandleProps}
          />
        );
      }

      if (kind === "slot") {
        if (!slot) {
          return (
            <div ref={ref} style={style}>
              <Text fontSize="sm" color="red.500">
                Slot "{node.name}" not found.
              </Text>
            </div>
          );
        }
        return (
          <SlotReferenceEdit
            ref={ref}
            style={style}
            node={node}
            slot={slot}
            isDragging={isDragging}
            onSave={handleSaveSlot}
            onCancel={handleCancel}
            dragHandleProps={dragHandleProps}
          />
        );
      }
    }

    // Render view mode based on node type
    if (kind === "message") {
      return (
        <MessageNodeView
          ref={ref}
          style={style}
          node={node}
          isDragging={isDragging}
          onEdit={handleEdit}
          onDelete={onDelete}
          dragHandleProps={dragHandleProps}
        />
      );
    }

    if (kind === "slot") {
      return (
        <SlotReferenceView
          ref={ref}
          style={style}
          node={node}
          slot={slot}
          isDragging={isDragging}
          onEdit={handleEdit}
          onDelete={onDelete}
          dragHandleProps={dragHandleProps}
        />
      );
    }

    const badKind = kind satisfies never;
    throw new Error(`Unsupported node kind: ${badKind}`);
  }
);
