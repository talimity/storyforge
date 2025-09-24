import { Accordion, Badge, Heading, HStack, Stack, Text, Textarea, VStack } from "@chakra-ui/react";
import { Controller, useFieldArray, useFormContext, useFormState } from "react-hook-form";
import { LuMessageSquarePlus } from "react-icons/lu";
import { Button, Field, Switch } from "@/components/ui";

export type StarterDraft = {
  id?: string;
  message: string;
  isPrimary: boolean;
};

export interface CharacterStartersEditorProps {
  disabled?: boolean;
}

type FormShape = {
  starters: StarterDraft[];
};

export function CharacterStartersEditor({ disabled }: CharacterStartersEditorProps) {
  const { control, setValue, getValues } = useFormContext<FormShape>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "starters",
    keyName: "formId",
  });

  // Enforce single-primary in UI: when one flips true, clear others
  const handlePrimaryToggle = (idx: number, next: boolean) => {
    if (next) {
      const current = getValues("starters") ?? [];
      current.forEach((_, i) => {
        if (i !== idx) setValue(`starters.${i}.isPrimary`, false, { shouldDirty: true });
      });
    }
    setValue(`starters.${idx}.isPrimary`, next, { shouldDirty: true });
  };

  return (
    <VStack align="stretch">
      <HStack justify="space-between" align="center">
        <Heading size="md">Scenario Starters</Heading>
        <Button
          onClick={() => append({ message: "", isPrimary: false })}
          variant="outline"
          disabled={disabled}
        >
          <LuMessageSquarePlus />
          Add Starter
        </Button>
      </HStack>

      {fields.length === 0 && (
        <Text color="content.muted" fontSize="sm">
          No starters added yet.
        </Text>
      )}

      {fields.length > 0 && (
        <Accordion.Root collapsible defaultValue={[]} width="full">
          {fields.map((field, idx) => (
            <StarterItem
              key={field.formId}
              idx={idx}
              field={field}
              disabled={disabled}
              onRemove={() => remove(idx)}
              onPrimaryToggle={(next) => handlePrimaryToggle(idx, next)}
            />
          ))}
        </Accordion.Root>
      )}
    </VStack>
  );
}

function StarterItem(props: {
  idx: number;
  field: { formId: string; id?: string; message?: string; isPrimary?: boolean };
  disabled?: boolean;
  onRemove: () => void;
  onPrimaryToggle: (next: boolean) => void;
}) {
  const { idx, field, disabled, onRemove, onPrimaryToggle } = props;
  const { control, register, getFieldState, formState } = useFormContext<FormShape>();
  useFormState({ name: `starters.${idx}.message`, control });
  const fs = getFieldState(`starters.${idx}.message`, formState);
  const isInvalid = !!fs.error;

  return (
    <Accordion.Item value={`starter-${idx}`}>
      <Accordion.ItemTrigger>
        <HStack gap={3} flex="1">
          <Text flex="1" color={isInvalid ? "red.600" : undefined}>
            Starter #{idx + 1}
          </Text>
          {isInvalid && (
            <Badge size="sm" colorPalette="red" variant="subtle" aria-label="This item has errors">
              Empty
            </Badge>
          )}
          <Controller
            control={control}
            name={`starters.${idx}.isPrimary`}
            defaultValue={!!field.isPrimary}
            render={({ field: ctrl }) => (
              <>{ctrl.value ? <Badge size="sm">Primary</Badge> : null}</>
            )}
          />
        </HStack>
        <Accordion.ItemIndicator />
      </Accordion.ItemTrigger>
      <Accordion.ItemContent>
        <Accordion.ItemBody px={0}>
          <VStack align="stretch" gap={4} width="full">
            <input type="hidden" {...register(`starters.${idx}.id`)} defaultValue={field.id} />
            <Field
              label="Message"
              helperText="You can use Markdown here"
              invalid={isInvalid}
              errorText={isInvalid ? "Starter message cannot be empty" : undefined}
            >
              <Textarea
                defaultValue={field.message}
                {...register(`starters.${idx}.message`)}
                rows={4}
                autoresize
                disabled={disabled}
                placeholder="Write the starter message..."
              />
            </Field>

            <Field label="Primary">
              <Controller
                control={control}
                name={`starters.${idx}.isPrimary`}
                defaultValue={!!field.isPrimary}
                render={({ field: ctrl }) => (
                  <Switch
                    colorPalette="primary"
                    checked={!!ctrl.value}
                    onCheckedChange={({ checked }) => onPrimaryToggle(!!checked)}
                    disabled={disabled}
                  >
                    Use as primary greeting
                  </Switch>
                )}
              />
            </Field>

            <Stack direction={{ base: "column", sm: "row" }} justify="space-between">
              <Button variant="outline" colorPalette="red" onClick={onRemove} disabled={disabled}>
                Delete Starter
              </Button>
            </Stack>
          </VStack>
        </Accordion.ItemBody>
      </Accordion.ItemContent>
    </Accordion.Item>
  );
}
