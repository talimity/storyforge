import { Text } from "@chakra-ui/react";
import { useShallow } from "zustand/react/shallow";
import { MessageNodeEdit } from "@/features/template-builder/components/nodes/message-node-edit";
import { MessageNodeView } from "@/features/template-builder/components/nodes/message-node-view";
import { NodeFrame } from "@/features/template-builder/components/nodes/node-frame";
import { SlotReferenceEdit } from "@/features/template-builder/components/nodes/slot-reference-edit";
import { SlotReferenceView } from "@/features/template-builder/components/nodes/slot-reference-view";
import { useTemplateBuilderStore } from "@/features/template-builder/stores/template-builder-store";
import type { LayoutNodeDraft, SlotDraft } from "@/features/template-builder/types";

interface LayoutNodeCardProps {
  node: LayoutNodeDraft;
  isDragging?: boolean;
  onDelete?: (nodeId: string) => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
  containerRef?: React.Ref<HTMLDivElement>;
}

export function LayoutNodeCard(props: LayoutNodeCardProps) {
  const { node, isDragging = false, onDelete, dragHandleProps, style, containerRef } = props;

  const { slots, editingNodeId, startEditingNode, saveNodeEdit, cancelNodeEdit } =
    useTemplateBuilderStore(
      useShallow((state) => ({
        slots: state.slotsDraft,
        editingNodeId: state.editingNodeId,
        startEditingNode: state.startEditingNode,
        saveNodeEdit: state.saveNodeEdit,
        cancelNodeEdit: state.cancelNodeEdit,
      }))
    );

  const isEditing = editingNodeId === node.id;

  const handleEdit = () => startEditingNode(node.id);

  const handleSaveNode = (updatedNode: LayoutNodeDraft) => {
    saveNodeEdit(node.id, updatedNode);
  };

  const handleSaveSlot = (updatedNode: LayoutNodeDraft, updatedSlot: SlotDraft) => {
    saveNodeEdit(node.id, updatedNode, updatedSlot);
  };

  const handleCancel = () => cancelNodeEdit();

  const slot = node.kind === "slot" ? slots[node.name] : undefined;

  if (isEditing) {
    if (node.kind === "message") {
      return (
        <MessageNodeEdit
          containerRef={containerRef}
          style={style}
          node={node}
          isDragging={isDragging}
          onSave={handleSaveNode}
          onCancel={handleCancel}
          dragHandleProps={dragHandleProps}
        />
      );
    }

    if (node.kind === "slot") {
      if (!slot) {
        return (
          <NodeFrame
            containerRef={containerRef}
            node={node}
            isDragging={isDragging}
            dragHandleProps={dragHandleProps}
            style={style}
          >
            <Text fontSize="sm" color="fg.error">
              Slot "{node.name}" not found.
            </Text>
          </NodeFrame>
        );
      }

      return (
        <SlotReferenceEdit
          containerRef={containerRef}
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

  if (node.kind === "message") {
    return (
      <MessageNodeView
        containerRef={containerRef}
        style={style}
        node={node}
        isDragging={isDragging}
        onEdit={handleEdit}
        onDelete={onDelete}
        dragHandleProps={dragHandleProps}
      />
    );
  }

  if (node.kind === "slot") {
    return (
      <SlotReferenceView
        containerRef={containerRef}
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

  throw new Error("Unsupported node kind");
}
