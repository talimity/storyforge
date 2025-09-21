import {
  Badge,
  createListCollection,
  HStack,
  Icon,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { ChatCompletionMessageRole } from "@storyforge/prompt-rendering";
import { useCallback } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { LuCheck, LuX } from "react-icons/lu";
import {
  AutosizeTextarea,
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  Switch,
} from "@/components/ui/index";
import { NodeFrame } from "@/features/template-builder/components/nodes/node-frame";
import {
  getMessageBlockPlaceholder,
  getNodeIcon,
  getRoleLabel,
  MESSAGE_ROLE_SELECT_OPTIONS,
} from "@/features/template-builder/services/builder-utils";
import type { MessageLayoutDraft } from "@/features/template-builder/types";

interface MessageNodeEditProps {
  node: MessageLayoutDraft;
  isDragging?: boolean;
  onSave?: (node: MessageLayoutDraft) => void;
  onCancel?: () => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
  ref: React.ForwardedRef<HTMLDivElement>;
}

export const MessageNodeEdit = (props: MessageNodeEditProps) => {
  const { node, isDragging = false, onSave, onCancel, dragHandleProps, style, ref } = props;
  const { register, control, setValue, getValues } = useForm({
    defaultValues: {
      role: node.role,
      name: node.name || "",
      content: node.content || "",
      skipIfEmptyInterpolation: node.skipIfEmptyInterpolation || false,
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
      skipIfEmptyInterpolation: values.skipIfEmptyInterpolation || false,
    };
    onSave?.(updatedNode);
  }, [node, onSave, getValues]);

  const handleRoleChange = useCallback(
    (newRole: ChatCompletionMessageRole) => {
      setValue("role", newRole);
    },
    [setValue]
  );

  const handleSkipChange = useCallback(
    (checked: boolean) => {
      setValue("skipIfEmptyInterpolation", checked);
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
            <IconButton size="xs" variant="ghost" onClick={onCancel} aria-label="Cancel edit">
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
                    const newRole = details.value[0] as ChatCompletionMessageRole;
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
            <AutosizeTextarea
              {...register("content")}
              placeholder="Enter message content..."
              minRows={4}
              fontFamily="mono"
            />
          </Field>

          <Field
            label="Skip if all variables are empty"
            helperText="If message content contains {{variables}} and none of them are filled, skip this message entirely."
          >
            <Controller
              name="skipIfEmptyInterpolation"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value || false}
                  colorPalette="primary"
                  onCheckedChange={({ checked }) => {
                    field.onChange(checked);
                    handleSkipChange(checked);
                  }}
                />
              )}
            />
          </Field>
        </VStack>
      </VStack>
    </NodeFrame>
  );
};

MessageNodeEdit.displayName = "MessageNodeEdit";
