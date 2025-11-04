import { Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { useEffect, useId } from "react";
import { LuFlag } from "react-icons/lu";
import {
  cloneChapterSeparatorAttachmentValues,
  getChapterSeparatorRoleOptions,
  serializeChapterSeparatorValues,
} from "@/features/template-builder/services/attachments/chapters";
import type { ChapterSeparatorAttachmentLaneDraft } from "@/features/template-builder/services/attachments/types";
import { useAppForm } from "@/lib/form/app-form";

interface ChapterSeparatorAttachmentsFormProps {
  draft: ChapterSeparatorAttachmentLaneDraft;
  onChange: (draft: ChapterSeparatorAttachmentLaneDraft) => void;
}

export function ChapterSeparatorAttachmentsForm({
  draft,
  onChange,
}: ChapterSeparatorAttachmentsFormProps) {
  const form = useAppForm({
    formId: `chapter-separator-attachments-form-${useId()}`,
    defaultValues: draft.values,
    listeners: {
      onBlur: ({ formApi }) => {
        const nextValues = cloneChapterSeparatorAttachmentValues(formApi.state.values);
        const nextSpec = serializeChapterSeparatorValues(nextValues);
        onChange({ laneId: draft.laneId, type: draft.type, values: nextValues, spec: nextSpec });
      },
    },
  });

  useEffect(() => {
    form.reset(draft.values);
  }, [form, draft.values]);

  const isEnabled = useStore(form.store, (state) => state.values.enabled);

  return (
    <Card.Root variant="outline" layerStyle="surface">
      <Card.Header w="full">
        <HStack justify="space-between" align="center">
          <HStack>
            <LuFlag />
            <Heading as="h3" size="md">
              Chapter Separator Settings
            </Heading>
          </HStack>
          <form.AppField name="enabled">
            {(field) => (
              <field.Switch
                fieldProps={{
                  width: "fit-content",
                }}
              >
                Insert chapter separators
              </field.Switch>
            )}
          </form.AppField>
        </HStack>
        <Text fontSize="sm" color="content.muted">
          Configure how chapter break markers are injected between timeline turns.
        </Text>
      </Card.Header>
      <Card.Body>
        <Stack gap={3}>
          <form.AppField name="template">
            {(field) => (
              <field.TextareaInput
                label="Separator Template"
                helperText="Variables: {{payload.chapterNumber}}, {{payload.title}}, {{payload.turnNo}}"
                minRows={2}
                maxRows={6}
                disabled={!isEnabled}
              />
            )}
          </form.AppField>
          <form.AppField name="role">
            {(field) => (
              <field.Select
                label="Message Role"
                placeholder="Select role"
                options={getChapterSeparatorRoleOptions()}
                disabled={!isEnabled}
              />
            )}
          </form.AppField>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
