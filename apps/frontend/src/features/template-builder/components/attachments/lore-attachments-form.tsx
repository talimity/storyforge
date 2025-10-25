import { Accordion, Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { useEffect, useId } from "react";
import { LuLibrary } from "react-icons/lu";
import {
  cloneLoreAttachmentValues,
  serializeLoreValues,
} from "@/features/template-builder/services/attachments/lore";
import type {
  LoreAttachmentFormValues,
  LoreAttachmentLaneDraft,
} from "@/features/template-builder/services/attachments/types";
import { MESSAGE_ROLE_SELECT_OPTIONS } from "@/features/template-builder/services/builder-utils";
import { useAppForm } from "@/lib/app-form";

interface LoreAttachmentsFormProps {
  draft: LoreAttachmentLaneDraft;
  onChange: (draft: LoreAttachmentLaneDraft) => void;
}

export function LoreAttachmentsForm({ draft, onChange }: LoreAttachmentsFormProps) {
  const form = useAppForm({
    formId: `lore-attachments-form-${useId()}`,
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

  const groupSections: Array<{
    key: keyof LoreAttachmentFormValues["groups"];
    accordionKey: string;
    title: string;
    description: string;
    templateHelper: string;
    headerHelper: string;
    footerHelper: string;
    headerLabel: string;
    footerLabel: string;
  }> = [
    {
      key: "perTurn",
      accordionKey: "per-turn",
      title: "At Specific Turn Depths",
      description:
        "Options for lore entries which are configured to appear a certain number of turns from the bottom of the scenario's timeline.",
      templateHelper: "Variables: {{payload.content}}, {{payload.name}}, {{payload.comment}}",
      headerHelper: "Appears before all entries for a given turn",
      footerHelper: "Appears after all entries for a given turn",
      headerLabel: "Turn Header",
      footerLabel: "Turn Footer",
    },
    {
      key: "beforeCharacters",
      accordionKey: "before",
      title: "Before Character Definitions",
      description:
        "Options for lore entries which are configured to appear before the Character Definitions section.",
      templateHelper: "Variables: {{payload.content}}, {{payload.name}}, {{payload.comment}}",
      headerHelper: "Appears before all entries in this group",
      footerHelper: "Appears after all entries in this group",
      headerLabel: "Header",
      footerLabel: "Footer",
    },
    {
      key: "afterCharacters",
      accordionKey: "after",
      title: "After Character Definitions",
      description:
        "Options for lore entries which are configured to appear after the Character Definitions section.",
      templateHelper: "Variables: {{payload.content}}, {{payload.name}}, {{payload.comment}}",
      headerHelper: "Appears before all entries in this group",
      footerHelper: "Appears after all entries in this group",
      headerLabel: "Header",
      footerLabel: "Footer",
    },
  ];

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
          Configure how activated lorebook entries are injected into your prompt layout.
        </Text>
      </Card.Header>
      <Card.Body>
        <Accordion.Root defaultValue={["per-turn"]} collapsible multiple>
          {groupSections.map((section) => (
            <Accordion.Item key={section.accordionKey} value={section.accordionKey}>
              <Accordion.ItemTrigger>
                {section.title}
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody px={1}>
                  <Text mb={3} color="content.muted" fontSize="sm">
                    {section.description}
                  </Text>
                  <Stack direction={{ base: "column", md: "row" }} gap={3}>
                    <form.AppField name={`groups.${section.key}.template`}>
                      {(field) => (
                        <field.TextareaInput
                          label="Entry Template"
                          helperText={section.templateHelper}
                          minRows={2}
                          maxRows={8}
                          disabled={!isEnabled}
                          fieldProps={{ flex: 1 }}
                        />
                      )}
                    </form.AppField>
                    <form.AppField name={`groups.${section.key}.role`}>
                      {(field) => (
                        <field.Select
                          label="Message Role"
                          options={MESSAGE_ROLE_SELECT_OPTIONS.slice()}
                          placeholder="Select role"
                          disabled={!isEnabled}
                          fieldProps={{ flexBasis: { base: "100%", md: "200px" } }}
                        />
                      )}
                    </form.AppField>
                  </Stack>

                  <Stack direction={{ base: "column", sm: "row" }} gap={3} mt={3}>
                    <form.AppField name={`groups.${section.key}.open`}>
                      {(field) => (
                        <field.TextareaInput
                          label={section.headerLabel}
                          helperText={section.headerHelper}
                          minRows={1}
                          maxRows={6}
                          disabled={!isEnabled}
                        />
                      )}
                    </form.AppField>

                    <form.AppField name={`groups.${section.key}.close`}>
                      {(field) => (
                        <field.TextareaInput
                          label={section.footerLabel}
                          helperText={section.footerHelper}
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
          ))}
        </Accordion.Root>
      </Card.Body>
    </Card.Root>
  );
}
