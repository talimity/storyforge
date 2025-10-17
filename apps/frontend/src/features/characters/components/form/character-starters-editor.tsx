import { Accordion, Badge, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { LuMessageSquarePlus } from "react-icons/lu";
import { Button } from "@/components/ui/index";
import { TabHeader } from "@/components/ui/tab-header";
import { withFieldGroup } from "@/lib/app-form";
import type { CharacterFormValues } from "./form-schemas";

export type StarterDraft = CharacterFormValues["starters"][number];

export interface CharacterStartersEditorProps extends Record<string, unknown> {
  disabled?: boolean;
}

const starterDefaults: StarterDraft = {
  message: "",
  isPrimary: false,
};

export const CharacterStartersEditor = withFieldGroup({
  defaultValues: { items: [] as StarterDraft[] },
  props: {
    disabled: false,
  } satisfies CharacterStartersEditorProps as CharacterStartersEditorProps,
  render: function Render({ group, disabled = false }) {
    return (
      <group.Field name="items" mode="array">
        {(startersField) => {
          const starters = startersField.state.value ?? [];

          const handleAdd = () => startersField.pushValue({ ...starterDefaults });

          const handlePrimaryToggle = (index: number, next: boolean) => {
            if (!starters.length) return;
            if (!next) {
              startersField.handleChange(
                starters.map((starter, idx) =>
                  idx === index ? { ...starter, isPrimary: false } : starter
                )
              );
              return;
            }

            startersField.handleChange(
              starters.map((starter, idx) => ({
                ...starter,
                isPrimary: idx === index,
              }))
            );
          };

          return (
            <VStack align="stretch" gap={4}>
              <TabHeader
                title="Scenario Starters"
                description="Opening turns for this character in a scenario."
                icon={LuMessageSquarePlus}
                actions={
                  <Button onClick={handleAdd} variant="outline" disabled={disabled}>
                    <LuMessageSquarePlus />
                    Add Starter
                  </Button>
                }
              />
              {/*<HStack justify="space-between" align="center">*/}
              {/*  <Heading size="md">Scenario Starters</Heading>*/}
              {/*  <Button onClick={handleAdd} variant="outline" disabled={disabled}>*/}
              {/*    <LuMessageSquarePlus />*/}
              {/*    Add Starter*/}
              {/*  </Button>*/}
              {/*</HStack>*/}

              {starters.length === 0 && (
                <Text color="content.muted" fontSize="sm">
                  No starters added yet.
                </Text>
              )}

              {starters.length > 0 && (
                <Accordion.Root collapsible defaultValue={[]} width="full">
                  {starters.map((_starter, idx) => (
                    <StarterItem
                      // biome-ignore lint/suspicious/noArrayIndexKey: required until TanStack Form supports stable keys
                      key={idx}
                      form={group}
                      fields={`items[${idx}]`}
                      idx={idx}
                      disabled={disabled}
                      onRemove={() => startersField.removeValue(idx)}
                      onPrimaryToggle={(next) => handlePrimaryToggle(idx, next)}
                    />
                  ))}
                </Accordion.Root>
              )}
            </VStack>
          );
        }}
      </group.Field>
    );
  },
});

interface StarterItemProps extends Record<string, unknown> {
  idx: number;
  disabled: boolean;
  onRemove: () => void;
  onPrimaryToggle: (next: boolean) => void;
}

const StarterItem = withFieldGroup({
  defaultValues: starterDefaults,
  props: {
    idx: 0,
    disabled: false,
    onRemove: () => {},
    onPrimaryToggle: () => {},
  } satisfies StarterItemProps as StarterItemProps,
  render: function Render({ group, idx, onRemove, onPrimaryToggle }) {
    const isPrimary = useStore(group.store, (state) => Boolean(state.values.isPrimary));

    return (
      <Accordion.Item value={`starter-${idx}`}>
        <Accordion.ItemTrigger>
          <HStack gap={3} flex="1">
            <group.Subscribe selector={(state) => state.values.message}>
              {() => {
                const messageMeta = group.getFieldMeta("message");
                const hasMessageError = Boolean(messageMeta?.errors?.length);

                return (
                  <>
                    <Text flex="1" color={hasMessageError ? "fg.error" : undefined}>
                      Starter #{idx + 1}
                    </Text>
                    {hasMessageError && (
                      <Badge
                        size="sm"
                        colorPalette="red"
                        variant="subtle"
                        aria-label="This item has errors"
                      >
                        Empty
                      </Badge>
                    )}
                  </>
                );
              }}
            </group.Subscribe>
            {isPrimary && <Badge size="sm">Default</Badge>}
          </HStack>
          <Accordion.ItemIndicator />
        </Accordion.ItemTrigger>
        <Accordion.ItemContent>
          <Accordion.ItemBody px={1}>
            <VStack align="stretch" gap={4} width="full">
              <group.AppField name="id">
                {(field) => (
                  <input type="hidden" name={field.name} value={field.state.value ?? ""} />
                )}
              </group.AppField>

              <group.AppField name="message">
                {(field) => (
                  <field.TextareaInput
                    label="Text"
                    helperText="Provide the opening message for this starter."
                    placeholder="Enter starter message..."
                    minRows={4}
                    maxRows={20}
                  />
                )}
              </group.AppField>

              <group.AppField name="isPrimary">
                {(field) => (
                  <field.Switch
                    colorPalette="primary"
                    onCheckedChange={(checked) => onPrimaryToggle(checked)}
                  >
                    Default Starter
                  </field.Switch>
                )}
              </group.AppField>

              <Stack direction={{ base: "column", sm: "row" }} justify="space-between">
                <Button variant="outline" colorPalette="red" onClick={onRemove}>
                  Delete Starter
                </Button>
              </Stack>
            </VStack>
          </Accordion.ItemBody>
        </Accordion.ItemContent>
      </Accordion.Item>
    );
  },
});
