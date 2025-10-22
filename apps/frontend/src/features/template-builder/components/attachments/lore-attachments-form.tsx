import { Accordion, Card, Heading, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { useEffect } from "react";
import { LuLibrary } from "react-icons/lu";
import {
  cloneLoreAttachmentValues,
  serializeLoreValues,
} from "@/features/template-builder/services/attachments/lore";
import type { LoreAttachmentLaneDraft } from "@/features/template-builder/services/attachments/types";
import { MESSAGE_ROLE_SELECT_OPTIONS } from "@/features/template-builder/services/builder-utils";
import { useAppForm } from "@/lib/app-form";

interface LoreAttachmentsFormProps {
  draft: LoreAttachmentLaneDraft;
  onChange: (draft: LoreAttachmentLaneDraft) => void;
}

export function LoreAttachmentsForm({ draft, onChange }: LoreAttachmentsFormProps) {
  const form = useAppForm({
    defaultValues: draft.values,
    listeners: {
      onBlur: ({ formApi }) => {
        const nextValues = cloneLoreAttachmentValues(formApi.state.values);
        const nextSpec = serializeLoreValues(nextValues);
        onChange({ laneId: draft.laneId, type: draft.type, values: nextValues, spec: nextSpec });
      },
    },
  });

  useEffect(() => {
    form.reset(draft.values);
  }, [form, draft.values]);

  const isEnabled = useStore(form.store, (state) => Boolean(state.values.enabled));

  return (
    <Card.Root variant="outline" layerStyle="surface">
      <Card.Header w="full">
        <HStack justify="space-between" align="center">
          <HStack>
            <LuLibrary />
            <Heading as="h3" size="md">
              Lorebook Injection Settings
            </Heading>
          </HStack>
          <form.AppField name="enabled">
            {(field) => (
              <field.Switch
                fieldProps={{
                  width: "fit-content",
                }}
              >
                Allow lorebook injections
              </field.Switch>
            )}
          </form.AppField>
        </HStack>
        <Text fontSize="sm" color="content.muted">
          Configure how activated lorebook entries are injected into the prompt.
        </Text>
      </Card.Header>
      <Card.Body>
        <VStack align="stretch" gap={4}>
          <form.AppField name="role">
            {(field) => (
              <field.Select
                label="Message Role"
                options={MESSAGE_ROLE_SELECT_OPTIONS.slice()}
                placeholder="Select role"
              />
            )}
          </form.AppField>

          <form.AppField name="template">
            {(field) => (
              <field.TextareaInput
                label="Lore Entry Template"
                helperText="Formatting applied to activated lore entries. Variables: {{payload.content}}, {{payload.name}}, {{payload.comment}}"
                minRows={3}
                maxRows={8}
              />
            )}
          </form.AppField>
        </VStack>
        <Accordion.Root defaultValue={[]} collapsible>
          <Accordion.Item value="before">
            <Accordion.ItemTrigger>
              <Text fontWeight="medium">Before Character Definitions</Text>
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody px={1}>
                <Text mb={2} color="content.muted" fontSize="sm">
                  Options for lore entries that are set to appear before the Character Definitions
                  section of your prompt.
                </Text>
                <Stack direction={{ base: "column", sm: "row" }} gap={3}>
                  <form.AppField name="groups.beforeCharacters.open">
                    {(field) => (
                      <field.TextareaInput
                        label="Header"
                        helperText="Appears before all entries in this group"
                        minRows={1}
                        maxRows={6}
                        disabled={!isEnabled}
                      />
                    )}
                  </form.AppField>

                  <form.AppField name="groups.beforeCharacters.close">
                    {(field) => (
                      <field.TextareaInput
                        label="Footer"
                        helperText="Appears after all entries in this group"
                        minRows={1}
                        maxRows={6}
                        disabled={!isEnabled}
                      />
                    )}
                  </form.AppField>
                </Stack>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>

          <Accordion.Item value="after">
            <Accordion.ItemTrigger>
              <Text fontWeight="medium">After Character Definitions</Text>
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody px={1}>
                <Text mb={2} color="content.muted" fontSize="sm">
                  Options for lore entries that are set to appear after the Character Definitions
                  section of your prompt.
                </Text>
                <Stack direction={{ base: "column", sm: "row" }} gap={3}>
                  <form.AppField name="groups.afterCharacters.open">
                    {(field) => (
                      <field.TextareaInput
                        label="Header"
                        helperText="Appears before all entries in this group"
                        minRows={1}
                        maxRows={6}
                        disabled={!isEnabled}
                      />
                    )}
                  </form.AppField>

                  <form.AppField name="groups.afterCharacters.close">
                    {(field) => (
                      <field.TextareaInput
                        label="Footer"
                        helperText="Appears after all entries in this group"
                        minRows={1}
                        maxRows={6}
                        disabled={!isEnabled}
                      />
                    )}
                  </form.AppField>
                </Stack>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>

          <Accordion.Item value="per-turn">
            <Accordion.ItemTrigger>
              <Text fontWeight="medium">At Timeline Depth</Text>
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody px={1}>
                <Text mb={2} color="content.muted" fontSize="sm">
                  Options for lore entries that are set to appear at particular depths within the
                  timeline section of your prompt.
                </Text>
                <Stack direction={{ base: "column", sm: "row" }} gap={3}>
                  <form.AppField name="groups.perTurn.open">
                    {(field) => (
                      <field.TextareaInput
                        label="Header"
                        helperText="Appears before all entries for a given turn"
                        minRows={1}
                        maxRows={6}
                        disabled={!isEnabled}
                      />
                    )}
                  </form.AppField>

                  <form.AppField name="groups.perTurn.close">
                    {(field) => (
                      <field.TextareaInput
                        label="Footer"
                        helperText="Appears after all entries for a given turn"
                        minRows={1}
                        maxRows={6}
                        disabled={!isEnabled}
                      />
                    )}
                  </form.AppField>
                </Stack>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>
        </Accordion.Root>
      </Card.Body>
    </Card.Root>
  );
}
