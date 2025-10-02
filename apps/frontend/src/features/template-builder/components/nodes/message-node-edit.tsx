import {
  Badge,
  createListCollection,
  HStack,
  Icon,
  IconButton,
  Input,
  VStack,
} from "@chakra-ui/react";
import type { ChatCompletionMessageRole } from "@storyforge/prompt-rendering";
import { useStore } from "@tanstack/react-form";
import { useEffect } from "react";
import { LuCheck, LuX } from "react-icons/lu";
import {
  AutosizeTextarea,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  Switch,
} from "@/components/ui";
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

const selectCollection = createListCollection({ items: MESSAGE_ROLE_SELECT_OPTIONS });

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

        <form.AppField name="name">
          {(field) => (
            <field.Field
              label="Identifier"
              helperText="Optional identifier for this message block (does not appear in prompt)"
            >
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value ?? ""}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={() => field.handleBlur()}
                placeholder={getMessageBlockPlaceholder(node.role)}
                autoComplete="off"
              />
            </field.Field>
          )}
        </form.AppField>

        <form.AppField name="role">
          {(field) => (
            <field.Field label="Message Role" required>
              <SelectRoot
                collection={selectCollection}
                value={[field.state.value]}
                onValueChange={(details) => {
                  const newRole = details.value[0] as ChatCompletionMessageRole;
                  field.handleChange(newRole);
                  field.handleBlur();
                }}
              >
                <SelectTrigger>
                  <SelectValueText placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {MESSAGE_ROLE_SELECT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} item={option}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            </field.Field>
          )}
        </form.AppField>

        <form.AppField name="content">
          {(field) => (
            <field.Field
              label="Content"
              helperText="The message content. Use {{variable}} syntax for templating."
            >
              <AutosizeTextarea
                minRows={4}
                fontFamily="mono"
                value={field.state.value ?? ""}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={() => field.handleBlur()}
                placeholder="Enter message content..."
              />
            </field.Field>
          )}
        </form.AppField>

        <form.AppField name="skipIfEmptyInterpolation">
          {(field) => (
            <field.Field
              label="Skip if all variables are empty"
              helperText="If message content contains {{variables}} and none of them are filled, skip this message entirely."
            >
              <Switch
                checked={Boolean(field.state.value)}
                colorPalette="primary"
                onCheckedChange={({ checked }) => field.handleChange(Boolean(checked))}
                onBlur={() => field.handleBlur()}
              />
            </field.Field>
          )}
        </form.AppField>
      </VStack>
    </NodeFrame>
  );
}
