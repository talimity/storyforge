import { Card, HStack, Tabs } from "@chakra-ui/react";
import { useId } from "react";
import { LuInfo, LuLibrary } from "react-icons/lu";
import type { z } from "zod";
import { useAppForm } from "@/lib/form/app-form";
import {
  type LorebookPayload,
  lorebookFormDefaultValues,
  lorebookSubmitSchema,
} from "./form-schemas";
import { LorebookDetailsSection } from "./lorebook-details-section";
import { LorebookEntriesEditor } from "./lorebook-entries-editor";

export interface LorebookFormProps {
  initialData?: Partial<z.input<typeof lorebookSubmitSchema>>;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (data: LorebookPayload) => Promise<unknown>;
}

export function LorebookForm({
  initialData,
  submitLabel = "Save Lorebook",
  onCancel,
  onSubmit,
}: LorebookFormProps) {
  const form = useAppForm({
    formId: `lorebook-form-${useId()}`,
    defaultValues: { ...lorebookFormDefaultValues, ...initialData },
    validators: { onBlur: lorebookSubmitSchema },
    onSubmit: ({ value }) => onSubmit(lorebookSubmitSchema.parse(value)),
  });

  return (
    <>
      <Card.Root layerStyle="surface" maxW="60rem" mx="auto">
        <form
          id={form.formId}
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <Tabs.Root defaultValue="metadata" lazyMount>
            <Tabs.List>
              <Tabs.Trigger value="metadata">
                <LuInfo />
                Metadata
              </Tabs.Trigger>
              <Tabs.Trigger value="entries">
                <LuLibrary />
                Entries
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="metadata" p={6}>
              <LorebookDetailsSection form={form} />
            </Tabs.Content>

            <Tabs.Content value="entries" p={6}>
              <LorebookEntriesEditor form={form} />
            </Tabs.Content>
          </Tabs.Root>

          <Card.Footer borderTopWidth={1} borderTopColor="border" pt={6}>
            <HStack justify="space-between" width="full">
              <form.AppForm>
                <form.CancelButton variant="ghost" onCancel={onCancel}>
                  Cancel
                </form.CancelButton>
                <form.SubmitButton form={form.formId} colorPalette="primary">
                  {submitLabel}
                </form.SubmitButton>
              </form.AppForm>
            </HStack>
          </Card.Footer>
        </form>
      </Card.Root>

      <form.AppForm>
        <form.SubscribedUnsavedChangesDialog
          title="Unsaved Lorebook"
          message="You have unsaved changes to this lorebook. Are you sure you want to leave?"
        />
      </form.AppForm>
    </>
  );
}
