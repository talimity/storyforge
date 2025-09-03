import {
  Badge,
  createListCollection,
  HStack,
  Icon,
  IconButton,
  Input,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import type { ChatCompletionMessageRole } from "@storyforge/prompt-rendering";
import { forwardRef, useCallback } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { LuCheck, LuX } from "react-icons/lu";
import {
  getMessageBlockPlaceholder,
  getNodeIcon,
  getRoleLabel,
  MESSAGE_ROLE_SELECT_OPTIONS,
} from "@/components/features/templates/builder/index";
import { NodeFrame } from "@/components/features/templates/builder/nodes/node-frame";
import type { MessageLayoutDraft } from "@/components/features/templates/types";
import {
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  Switch,
} from "@/components/ui";

interface MessageNodeEditProps {
  node: MessageLayoutDraft;
  isDragging?: boolean;
  onSave?: (node: MessageLayoutDraft) => void;
  onCancel?: () => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}

export const MessageNodeEdit = forwardRef<HTMLDivElement, MessageNodeEditProps>(
  (props, ref) => {
    const {
      node,
      isDragging = false,
      onSave,
      onCancel,
      dragHandleProps,
      style,
    } = props;
    const { register, control, setValue, getValues } = useForm({
      defaultValues: {
        role: node.role,
        name: node.name || "",
        content: node.content || "",
        prefix: node.prefix || false,
      },
      shouldUnregister: true,
    });
    // subscribe to role to update the icon live
    const role = useWatch({ control, name: "role" });
    const NodeIcon = getNodeIcon({ kind: "message", role });

    const handleSave = useCallback(() => {
      const values = getValues();
      const updatedNode: MessageLayoutDraft = {
        ...node,
        role: values.role,
        name: values.name || undefined,
        content: values.content || undefined,
        prefix: values.prefix || undefined,
      };
      onSave?.(updatedNode);
    }, [node, onSave, getValues]);

    const handleRoleChange = useCallback(
      (newRole: ChatCompletionMessageRole) => {
        setValue("role", newRole);
      },
      [setValue]
    );

    const handlePrefixChange = useCallback(
      (checked: boolean) => {
        setValue("prefix", checked);
      },
      [setValue]
    );

    return (
      <NodeFrame
        ref={ref}
        node={node}
        isDragging={isDragging}
        dragHandleProps={dragHandleProps}
        style={style}
      >
        <VStack align="stretch" gap={4}>
          {/* Header */}
          <HStack gap={2} align="center">
            <Icon as={NodeIcon} />
            <Badge size="sm">{getRoleLabel(role)}</Badge>
            <Text fontSize="sm" fontWeight="medium" flex={1}>
              Editing Message
            </Text>
            <HStack gap={1}>
              <IconButton
                size="xs"
                colorPalette="green"
                onClick={handleSave}
                aria-label="Save changes"
              >
                <LuCheck />
              </IconButton>
              <IconButton
                size="xs"
                variant="ghost"
                onClick={onCancel}
                aria-label="Cancel edit"
              >
                <LuX />
              </IconButton>
            </HStack>
          </HStack>

          {/* Form Fields */}
          <VStack align="stretch" gap={4}>
            <Field
              label="Identifier"
              helperText="Optional identifier for this message block (does not appear in prompt)"
            >
              <Input
                {...register("name")}
                placeholder={getMessageBlockPlaceholder(node.role)}
                autoComplete="off"
              />
            </Field>

            <Field label="Message Role" required>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <SelectRoot
                    collection={createListCollection({
                      items: MESSAGE_ROLE_SELECT_OPTIONS,
                    })}
                    value={[field.value]}
                    onValueChange={(details) => {
                      const newRole = details
                        .value[0] as ChatCompletionMessageRole;
                      field.onChange(newRole);
                      handleRoleChange(newRole);
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
                )}
              />
            </Field>

            <Field
              label="Content"
              helperText="The message content. Use {{variable}} syntax for templating."
            >
              <Textarea
                {...register("content")}
                placeholder="Enter message content..."
                rows={4}
                autoresize
                fontFamily="mono"
              />
            </Field>

            {role === "assistant" && (
              <Field
                label="Assistant Prefill"
                helperText="If enabled for the final message, this will prefill the assistant's response with the provided content. Requires provider support."
              >
                <Controller
                  name="prefix"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value || false}
                      colorPalette="primary"
                      onCheckedChange={({ checked }) => {
                        field.onChange(checked);
                        handlePrefixChange(checked);
                      }}
                    />
                  )}
                />
              </Field>
            )}
          </VStack>
        </VStack>
      </NodeFrame>
    );
  }
);

MessageNodeEdit.displayName = "MessageNodeEdit";
