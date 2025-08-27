import type { TaskKind } from "@storyforge/prompt-renderer";
import { forwardRef, useState } from "react";
import type { LayoutNodeDraft, SlotDraft } from "../types";
import {
  MessageNodeEdit,
  MessageNodeView,
  SeparatorNodeEdit,
  SeparatorNodeView,
  SlotReferenceEdit,
  SlotReferenceView,
} from "./nodes";

interface LayoutNodeCardProps {
  node: LayoutNodeDraft;
  slots?: Record<string, SlotDraft>;
  task?: TaskKind;
  isSelected?: boolean;
  isDragging?: boolean;
  onNodeChange?: (node: LayoutNodeDraft) => void;
  onSlotChange?: (slot: SlotDraft) => void;
  onDelete?: (nodeId: string) => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}

export const LayoutNodeCard = forwardRef<HTMLDivElement, LayoutNodeCardProps>(
  (
    {
      node,
      slots = {},
      task,
      isSelected = false,
      isDragging = false,
      onNodeChange,
      onSlotChange,
      onDelete,
      dragHandleProps,
      style,
    },
    ref
  ) => {
    const [isEditing, setIsEditing] = useState(false);

    const handleEdit = () => {
      setIsEditing(true);
    };

    const handleSaveNode = (updatedNode: LayoutNodeDraft) => {
      onNodeChange?.(updatedNode);
      setIsEditing(false);
    };

    const handleSaveSlot = (
      updatedNode: LayoutNodeDraft,
      updatedSlot: SlotDraft
    ) => {
      onNodeChange?.(updatedNode);
      onSlotChange?.(updatedSlot);
      setIsEditing(false);
    };

    const handleCancel = () => {
      setIsEditing(false);
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
            isSelected={isSelected}
            isDragging={isDragging}
            onSave={handleSaveNode}
            onCancel={handleCancel}
            dragHandleProps={dragHandleProps}
          />
        );
      }

      if (kind === "separator") {
        return (
          <SeparatorNodeEdit
            ref={ref}
            style={style}
            node={node}
            isSelected={isSelected}
            isDragging={isDragging}
            onSave={handleSaveNode}
            onCancel={handleCancel}
            dragHandleProps={dragHandleProps}
          />
        );
      }

      if (kind === "slot") {
        return (
          <SlotReferenceEdit
            ref={ref}
            style={style}
            node={node}
            slot={slot}
            task={task}
            isSelected={isSelected}
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
          isSelected={isSelected}
          isDragging={isDragging}
          onEdit={handleEdit}
          onDelete={onDelete}
          dragHandleProps={dragHandleProps}
        />
      );
    }

    if (kind === "separator") {
      return (
        <SeparatorNodeView
          ref={ref}
          style={style}
          node={node}
          isSelected={isSelected}
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
          isSelected={isSelected}
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
