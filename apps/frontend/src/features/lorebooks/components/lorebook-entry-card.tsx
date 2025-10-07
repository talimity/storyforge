import { Badge, Card, HStack, IconButton, Stack, Text, VStack } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { LuChevronDown, LuChevronUp, LuCopy, LuTrash } from "react-icons/lu";
import { AutosizeTextarea, Button } from "@/components/ui";
import { withFieldGroup } from "@/lib/app-form";
import { showErrorToast } from "@/lib/error-handling";
import { createLorebookEntryDraft } from "./form-schemas";

type LorebookEntryCardProps = {
  index: number;
  total: number;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
} & Record<string, unknown>;

function joinList(value: string[] | undefined) {
  return (value ?? []).join("\n");
}

function toLineArray(value: string, { preserveEmpty }: { preserveEmpty: boolean }) {
  const lines = value.split(/\r?\n/);
  if (preserveEmpty) return lines;
  return lines.map((line) => line.trim()).filter(Boolean);
}

function stringifyExtensions(value: Record<string, unknown> | undefined) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch (error) {
    console.error("Failed to stringify entry extensions", error);
    return "{}";
  }
}

function parseExtensions(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error("Extensions must be a JSON object");
  } catch (error) {
    showErrorToast({
      title: "Invalid entry extensions",
      error,
    });
    return undefined;
  }
}

export const LorebookEntryCard = withFieldGroup({
  defaultValues: createLorebookEntryDraft(0),
  props: {
    index: 0,
    total: 0,
    onRemove: () => {},
    onDuplicate: () => {},
    onMoveUp: () => {},
    onMoveDown: () => {},
  } satisfies LorebookEntryCardProps as LorebookEntryCardProps,
  render: function Render({ group, index, total, onDuplicate, onRemove, onMoveDown, onMoveUp }) {
    const isEnabled = useStore(group.store, (state) => Boolean(state.values.enabled));
    const alwaysActive = useStore(group.store, (state) => Boolean(state.values.constant));
    const entryTitle = useStore(group.store, (state) => state.values.comment)?.trim();

    return (
      <Card.Root layerStyle="surface">
        <Card.Header>
          <HStack justify="space-between" align="center" width="full">
            <Text fontWeight="medium">
              Entry #{index + 1}
              {entryTitle ? ` · ${entryTitle}` : ""}
            </Text>
            <HStack gap={2}>
              {!isEnabled && (
                <Badge colorPalette="yellow" variant="subtle">
                  Disabled
                </Badge>
              )}
              <IconButton
                aria-label="Move up"
                size="xs"
                variant="ghost"
                onClick={onMoveUp}
                disabled={index === 0}
              >
                <LuChevronUp />
              </IconButton>
              <IconButton
                aria-label="Move down"
                size="xs"
                variant="ghost"
                onClick={onMoveDown}
                disabled={index === total - 1}
              >
                <LuChevronDown />
              </IconButton>
              <IconButton aria-label="Duplicate" size="xs" variant="ghost" onClick={onDuplicate}>
                <LuCopy />
              </IconButton>
              <IconButton
                aria-label="Delete"
                size="xs"
                variant="ghost"
                colorPalette="red"
                onClick={onRemove}
              >
                <LuTrash />
              </IconButton>
            </HStack>
          </HStack>
        </Card.Header>

        <Card.Body>
          <VStack align="stretch" gap={4}>
            <Stack direction={{ base: "column", sm: "row" }} gap={3}>
              <group.AppField name="enabled">
                {(field) => (
                  <field.Switch
                    colorPalette="primary"
                    helperText="Disabled entries will never be included in prompts"
                  >
                    Enabled
                  </field.Switch>
                )}
              </group.AppField>
              <group.AppField name="constant">
                {(field) => (
                  <field.Switch helperText="Ignore keywords and always include this entry in prompts">
                    Always Active
                  </field.Switch>
                )}
              </group.AppField>
            </Stack>

            {/*<group.AppField name="name">*/}
            {/*  {(field) => <field.TextInput label="Entry Name" placeholder="Optional label" />}*/}
            {/*</group.AppField>*/}

            <group.AppField name="comment">
              {(field) => (
                <field.TextInput
                  label="Title / Memo"
                  helperText="Optional title or comment identifying this entry"
                  placeholder="Optional"
                />
              )}
            </group.AppField>

            <group.AppField name="keys">
              {(field) => (
                <field.Field
                  label="Trigger Keywords"
                  helperText="One keyword or regex per line"
                  style={{ opacity: alwaysActive ? 0.75 : 1 }}
                  invalid={field.state.meta.errors.length > 0}
                  errorText={field.state.meta.errors[0]}
                >
                  <AutosizeTextarea
                    disabled={alwaysActive}
                    value={joinList(field.state.value)}
                    onChange={(event) =>
                      field.handleChange(toLineArray(event.target.value, { preserveEmpty: true }))
                    }
                    onBlur={(event) => {
                      const cleaned = toLineArray(event.target.value, { preserveEmpty: false });
                      field.handleChange(cleaned.length > 0 ? cleaned : [""]);
                      field.handleBlur();
                    }}
                    minRows={1}
                    maxRows={6}
                  />
                </field.Field>
              )}
            </group.AppField>

            <group.AppField name="secondary_keys">
              {(field) => (
                <field.Field
                  label="Secondary Keywords"
                  helperText="Optional. Provide additional keywords to require alongside primary triggers."
                  style={{ opacity: alwaysActive ? 0.75 : 1 }}
                >
                  <AutosizeTextarea
                    disabled={alwaysActive}
                    value={joinList(field.state.value)}
                    onChange={(event) =>
                      field.handleChange(toLineArray(event.target.value, { preserveEmpty: true }))
                    }
                    onBlur={(event) => {
                      const cleaned = toLineArray(event.target.value, { preserveEmpty: false });
                      const next = cleaned.length > 0 ? cleaned : undefined;
                      field.handleChange(next);
                      field.handleBlur();
                      group.setFieldValue("selective", Boolean(next?.length));
                    }}
                    minRows={1}
                    maxRows={6}
                  />
                </field.Field>
              )}
            </group.AppField>

            <Stack direction={{ base: "column", md: "row" }} gap={3}>
              <group.AppField name="case_sensitive">
                {(field) => (
                  <field.Switch disabled={alwaysActive}>Case sensitive matching</field.Switch>
                )}
              </group.AppField>
              <group.AppField name="use_regex">
                {(field) => (
                  <field.Switch disabled={alwaysActive}>Interpret keys as regex</field.Switch>
                )}
              </group.AppField>
            </Stack>

            <group.AppField name="content">
              {(field) => (
                <field.TextareaInput
                  label="Content"
                  helperText="Inserted into the prompt when the entry triggers"
                  minRows={4}
                  maxRows={12}
                  required
                />
              )}
            </group.AppField>

            <Stack direction={{ base: "column", md: "row" }} gap={3}>
              <group.AppField name="insertion_order">
                {(field) => (
                  <field.NumberInput
                    label="Insertion Order"
                    helperText="Lower numbers appear earlier in the prompt"
                    fieldProps={{ flex: 1 }}
                  />
                )}
              </group.AppField>
              <group.AppField name="priority">
                {(field) => (
                  <field.NumberInput
                    label="Budget Priority"
                    helperText="Lower values are trimmed first if over token budget"
                    allowEmpty
                    fieldProps={{ flex: 1 }}
                  />
                )}
              </group.AppField>
            </Stack>

            <Stack gap={2}>
              <Text fontWeight="medium">Entry Extensions</Text>
              <group.AppField name="extensions">
                {(field) => {
                  const serialized = stringifyExtensions(field.state.value);
                  return (
                    <AutosizeTextarea
                      value={serialized}
                      onChange={(event) => {
                        const parsed = parseExtensions(event.target.value);
                        if (parsed !== undefined) {
                          field.handleChange(parsed);
                        }
                      }}
                      onBlur={() => field.handleBlur()}
                      fontFamily="mono"
                      rows={4}
                      placeholder="{ }"
                    />
                  );
                }}
              </group.AppField>
            </Stack>
          </VStack>
        </Card.Body>

        <Card.Footer>
          <Button variant="outline" colorPalette="red" onClick={onRemove}>
            Delete Entry
          </Button>
        </Card.Footer>
      </Card.Root>
    );
  },
});
