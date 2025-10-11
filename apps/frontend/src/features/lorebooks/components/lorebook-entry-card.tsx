import { Card, Flex, Icon, Stack, Text, VStack } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { LuCaseSensitive, LuRegex } from "react-icons/lu";
import { AutosizeTextarea } from "@/components/ui";
import { Tag } from "@/components/ui/tag";
import { LorebookEntryCardHeader } from "@/features/lorebooks/components/lorebook-entry-card-header";
import { LorebookExtensionsSection } from "@/features/lorebooks/components/lorebook-extensions-section";
import { withFieldGroup } from "@/lib/app-form";
import { createLorebookEntryDraft, extensionsJsonSchema } from "./form-schemas";

export type LorebookEntryCardProps = {
  index: number;
  total: number;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDismiss: () => void;
} & Record<string, unknown>;

const joinList = (value: string[] | undefined) => (value ?? []).join("\n");
const toLineArray = (value: string) => value.split(/\r?\n/);

function LoreSectionOptionLabel(props: { label: React.ReactNode; value: string }) {
  const { label, value } = props;
  return (
    <Stack direction="row">
      <Text>{label}</Text>
      <Tag color="content.muted">{value}</Tag>
    </Stack>
  );
}

const LORE_SECTION_OPTIONS = [
  {
    label: <LoreSectionOptionLabel label="First Section" value="before_char" />,
    value: "before_char",
  },
  {
    label: <LoreSectionOptionLabel label="Second Section" value="after_char" />,
    value: "after_char",
  },
];

function estimateTokenLength(text: string) {
  return Math.ceil(text.length / 4 / 10) * 10;
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
    onEdit: () => {},
    onDismiss: () => {},
  } satisfies LorebookEntryCardProps as LorebookEntryCardProps,
  render: function Render(props) {
    const { group } = props;
    const isEnabled = useStore(group.store, (state) => Boolean(state.values.enabled));
    const alwaysActive = useStore(group.store, (state) => Boolean(state.values.constant));
    const entryTitle = useStore(group.store, (state) => state.values.comment)?.trim();

    return (
      <Card.Root layerStyle="surface" size="sm">
        <LorebookEntryCardHeader
          {...props}
          isEditing
          isEnabled={isEnabled}
          entryTitle={entryTitle || ""}
        />

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
                  <field.Switch helperText="Always inject this entry in prompts regardless of triggers">
                    Always Active
                  </field.Switch>
                )}
              </group.AppField>
            </Stack>

            <group.AppField name="comment">
              {(field) => (
                <field.TextInput
                  label="Title / Memo"
                  helperText="Optional title or comment identifying this entry"
                  placeholder="Optional"
                />
              )}
            </group.AppField>

            <Stack direction={{ base: "column", md: "row" }} gap={3}>
              <group.AppField name="keys">
                {(field) => (
                  <field.Field
                    label="Trigger Phrases"
                    helperText="Phrases that will activate this entry (one per line)"
                    style={{ opacity: alwaysActive ? 0.75 : 1 }}
                  >
                    <AutosizeTextarea
                      disabled={alwaysActive}
                      value={joinList(field.state.value)}
                      onChange={(event) => field.handleChange(toLineArray(event.target.value))}
                      onBlur={(event) => {
                        const arr = toLineArray(event.target.value);
                        const cleaned = arr.filter((line) => line.trim().length > 0);
                        field.handleChange(cleaned.length > 0 ? cleaned : []);
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
                    label="Secondary Phrases"
                    helperText="If provided, at least one primary and one secondary must be present to activate this entry"
                    style={{ opacity: alwaysActive ? 0.75 : 1 }}
                  >
                    <AutosizeTextarea
                      disabled={alwaysActive}
                      value={joinList(field.state.value)}
                      onChange={(event) => field.handleChange(toLineArray(event.target.value))}
                      onBlur={(event) => {
                        const arr = toLineArray(event.target.value);
                        const cleaned = arr.filter((line) => line.trim().length > 0);
                        field.handleChange(cleaned.length > 0 ? cleaned : []);
                        field.handleBlur();
                        group.setFieldValue("selective", Boolean(cleaned?.length));
                      }}
                      minRows={1}
                      maxRows={6}
                    />
                  </field.Field>
                )}
              </group.AppField>
            </Stack>

            <Stack direction={{ base: "column", md: "row" }} gap={3}>
              <group.AppField name="case_sensitive">
                {(field) => (
                  <field.Switch disabled={alwaysActive}>Case sensitive matching</field.Switch>
                )}
              </group.AppField>
              <group.AppField name="use_regex">
                {(field) => (
                  <field.Switch disabled={alwaysActive}>Interpret phrases as regexps</field.Switch>
                )}
              </group.AppField>
            </Stack>

            <group.AppField name="content">
              {(field) => {
                const tokenCount = estimateTokenLength(field.state.value || "");
                return (
                  <field.TextareaInput
                    label="Content"
                    helperText={`Inserted into the prompt when the entry triggers - approx. ${tokenCount} tokens`}
                    minRows={4}
                    maxRows={12}
                    required
                  />
                );
              }}
            </group.AppField>

            <Stack direction={{ base: "column", md: "row" }} gap={3}>
              <group.AppField name="position">
                {(field) => (
                  <field.Select
                    label="Lore Section"
                    helperText="Where prompts should insert this entry"
                    options={LORE_SECTION_OPTIONS}
                    fieldProps={{ flex: 1 }}
                  />
                )}
              </group.AppField>
              <group.AppField name="insertion_order">
                {(field) => (
                  <field.NumberInput
                    label="Insertion Order"
                    required
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
                    placeholder="Auto"
                    allowEmpty
                    fieldProps={{ flex: 1 }}
                  />
                )}
              </group.AppField>
            </Stack>

            <LorebookExtensionsSection>
              <group.AppField name="extensions">
                {(field) => (
                  <field.JsonEditor
                    helperText="Store custom metadata consumed by other tools. Leave empty if unused."
                    formatOnBlur
                    height="250px"
                    schema={extensionsJsonSchema}
                  />
                )}
              </group.AppField>
            </LorebookExtensionsSection>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  },
});

export const LorebookEntryCardViewMode = withFieldGroup({
  defaultValues: createLorebookEntryDraft(0),
  props: {
    index: 0,
    total: 0,
    onRemove: () => {},
    onDuplicate: () => {},
    onMoveUp: () => {},
    onMoveDown: () => {},
    onEdit: () => {},
    onDismiss: () => {},
  } satisfies LorebookEntryCardProps as LorebookEntryCardProps,
  render: function Render(props) {
    const { group } = props;
    const isEnabled = useStore(group.store, (state) => Boolean(state.values.enabled));
    const entryTitle = useStore(group.store, (state) => state.values.comment)?.trim();
    const alwaysActive = useStore(group.store, (state) => Boolean(state.values.constant));
    const keys = useStore(group.store, (state) => state.values.keys);
    const secondaryKeys = useStore(group.store, (state) => state.values.secondary_keys);
    const content = useStore(group.store, (state) => state.values.content);
    // const insertionOrder = useStore(group.store, (state) => state.values.insertion_order);
    // const priority = useStore(group.store, (state) => state.values.priority);
    const caseSensitive = useStore(group.store, (state) => Boolean(state.values.case_sensitive));
    const useRegex = useStore(group.store, (state) => Boolean(state.values.use_regex));
    // const extensions = useStore(group.store, (state) => state.values.extensions);

    return (
      <Card.Root layerStyle="surface" size="sm">
        <LorebookEntryCardHeader
          {...props}
          isEditing={false}
          isEnabled={isEnabled}
          entryTitle={entryTitle || ""}
        />
        <Card.Body>
          <Flex gap={2} flexWrap="wrap" mb={2}>
            {alwaysActive ? (
              <Tag size="sm" colorPalette="purple">
                Always Active
              </Tag>
            ) : (
              <>
                {caseSensitive && (
                  <Icon size="sm">
                    <LuCaseSensitive />
                  </Icon>
                )}
                {useRegex && (
                  <Icon size="sm">
                    <LuRegex />
                  </Icon>
                )}
                {keys.map((key, idx) => (
                  <Tag key={`key_${idx}_${key}`} size="sm" colorPalette="blue">
                    {key}
                  </Tag>
                ))}
                {(secondaryKeys || []).map((key, idx) => (
                  <Tag key={`secondary_${idx}_${key}`} size="sm" colorPalette="cyan">
                    {key}
                  </Tag>
                ))}
              </>
            )}
          </Flex>
          <Text fontSize="xs" color="content.muted" lineClamp={2} whiteSpace="pre-wrap">
            {content || "[ No content ]"}
          </Text>
        </Card.Body>
      </Card.Root>
    );
  },
});
