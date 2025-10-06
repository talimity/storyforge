import { Card, HStack, Stack, Tabs } from "@chakra-ui/react";
import { useAppForm } from "@/lib/app-form";
import {
  type LorebookFormValues,
  lorebookFormDefaultValues,
  lorebookFormSchema,
} from "./form-schemas";
import { LorebookDetailsSection } from "./lorebook-details-section";
import { LorebookEntriesEditor } from "./lorebook-entries-editor";

export interface LorebookFormProps {
  initialData?: Partial<LorebookFormValues>;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (data: LorebookFormValues) => Promise<unknown>;
}

export function LorebookForm({
  initialData,
  submitLabel = "Save Lorebook",
  onCancel,
  onSubmit,
}: LorebookFormProps) {
  const form = useAppForm({
    defaultValues: { ...lorebookFormDefaultValues, ...initialData },
    validators: { onChange: lorebookFormSchema },
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
    <>
      <Card.Root layerStyle="surface" maxW="900px" mx="auto">
        <form
          id="lorebook-form"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <Tabs.Root defaultValue="details" lazyMount>
            <Tabs.List>
              <Tabs.Trigger value="details">Details</Tabs.Trigger>
              <Tabs.Trigger value="entries">Entries</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="details" p={6}>
              <LorebookDetailsSection form={form} />
            </Tabs.Content>

            <Tabs.Content value="entries" p={6}>
              <LorebookEntriesEditor form={form} />
            </Tabs.Content>
          </Tabs.Root>

          <Stack p={6} pt={0}>
            <HStack justify="space-between">
              <form.AppForm>
                <form.CancelButton variant="ghost" onCancel={onCancel}>
                  Cancel
                </form.CancelButton>
                <form.SubmitButton form="lorebook-form" colorPalette="primary">
                  {submitLabel}
                </form.SubmitButton>
              </form.AppForm>
            </HStack>
          </Stack>
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
