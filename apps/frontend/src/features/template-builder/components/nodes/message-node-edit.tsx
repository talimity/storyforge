import { Badge, HStack, Icon, IconButton, Stack, VStack } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { useEffect } from "react";
import { LuCheck, LuX } from "react-icons/lu";
import { NodeFrame } from "@/features/template-builder/components/nodes/node-frame";
import {
  getMessageBlockPlaceholder,
  getNodeIcon,
  getRoleLabel,
  MESSAGE_ROLE_SELECT_OPTIONS,
} from "@/features/template-builder/services/builder-utils";
import type { MessageLayoutDraft } from "@/features/template-builder/types";
import { useAppForm } from "@/lib/app-form";

interface MessageNodeEditProps {
  node: MessageLayoutDraft;
  isDragging?: boolean;
  onSave?: (node: MessageLayoutDraft) => void;
  onCancel?: () => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
  containerRef?: React.Ref<HTMLDivElement>;
}

export function MessageNodeEdit(props: MessageNodeEditProps) {
  const {
    node,
    isDragging = false,
    onSave,
    onCancel,
    dragHandleProps,
    style,
    containerRef,
  } = props;

  const form = useAppForm({
    defaultValues: {
      role: node.role,
      name: node.name ?? "",
      content: node.content ?? "",
      skipIfEmptyInterpolation: node.skipIfEmptyInterpolation ?? false,
    },
  });

  useEffect(() => {
    form.reset({
      role: node.role,
      name: node.name ?? "",
      content: node.content ?? "",
      skipIfEmptyInterpolation: node.skipIfEmptyInterpolation ?? false,
    });
  }, [form, node]);

  const role = useStore(form.store, (state) => state.values.role);
  const NodeIcon = getNodeIcon({ kind: "message", role });

  const handleSave = () => {
    const values = form.state.values;
    const updatedNode: MessageLayoutDraft = {
      ...node,
      role: values.role,
      name: values.name ? values.name : undefined,
      content: values.content ? values.content : undefined,
      skipIfEmptyInterpolation: Boolean(values.skipIfEmptyInterpolation),
    };
    onSave?.(updatedNode);
  };

  return (
    <NodeFrame
      containerRef={containerRef}
      node={node}
      isDragging={isDragging}
      dragHandleProps={dragHandleProps}
      style={style}
    >
      <VStack align="stretch" gap={4}>
        <HStack gap={2} align="center">
          <Icon as={NodeIcon} />
          <Badge size="sm">{getRoleLabel(role)}</Badge>
          <HStack gap={1} ml="auto">
            <IconButton
              size="xs"
              colorPalette="green"
              onClick={handleSave}
              aria-label="Save changes"
            >
              <LuCheck />
            </IconButton>
            <IconButton size="xs" variant="ghost" onClick={onCancel} aria-label="Cancel edit">
              <LuX />
            </IconButton>
          </HStack>
        </HStack>

        <Stack gap={3} direction={{ base: "column", md: "row" }}>
          <form.AppField name="name">
            {(field) => (
              <field.TextInput
                label="Identifier"
                helperText="Optional identifier for this message block (does not appear in prompt)"
                placeholder={getMessageBlockPlaceholder(node.role)}
              />
            )}
          </form.AppField>

          <form.AppField name="role">
            {(field) => (
              <field.Select
                label="Message Role"
                helperText="Chat role used when rendering this message"
                options={MESSAGE_ROLE_SELECT_OPTIONS.slice()}
                placeholder="Select role"
                required
              />
            )}
          </form.AppField>
        </Stack>

        <form.AppField name="content">
          {(field) => (
            <field.TextareaInput
              label="Content"
              helperText="The message content. Use {{variable}} syntax for templating."
              minRows={4}
              placeholder="Enter message content..."
            />
          )}
        </form.AppField>

        <form.AppField name="skipIfEmptyInterpolation">
          {(field) => (
            <field.Switch helperText="If message content contains {{variables}} and none of them are filled, skip this message entirely.">
              Skip if all variables are empty
            </field.Switch>
          )}
        </form.AppField>
      </VStack>
    </NodeFrame>
  );
}
