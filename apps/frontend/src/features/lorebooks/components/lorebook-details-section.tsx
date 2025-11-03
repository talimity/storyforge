import { Stack } from "@chakra-ui/react";
import { LuBookOpen } from "react-icons/lu";
import { TabHeader } from "@/components/ui/tab-header";
import { LorebookExtensionsSection } from "@/features/lorebooks/components/lorebook-extensions-section";
import { withForm } from "@/lib/form/app-form";
import { extensionsJsonSchema, lorebookFormDefaultValues } from "./form-schemas";

export const LorebookDetailsSection = withForm({
  defaultValues: lorebookFormDefaultValues,
  render: function Render({ form }) {
    return (
      <Stack gap={6}>
        <TabHeader
          title="Lorebook Metadata"
          description="Configure basic metadata and global settings."
          icon={LuBookOpen}
        />

        <Stack gap={4}>
          <form.AppField name="name">
            {(field) => <field.TextInput label="Lorebook Name" required placeholder="Enter name" />}
          </form.AppField>

          <form.AppField name="description">
            {(field) => (
              <field.TextareaInput
                label="Description"
                helperText="For your reference only; not used in prompts"
                minRows={3}
                maxRows={6}
              />
            )}
          </form.AppField>
        </Stack>

        <Stack direction={{ base: "column", md: "row" }} gap={4} align="stretch">
          <form.AppField name="scan_depth">
            {(field) => (
              <field.NumberInput
                label="Scan Depth"
                helperText="How many recent turns to scan for trigger phrases"
                placeholder="automatic"
                allowEmpty
                fieldProps={{ flex: 1 }}
              />
            )}
          </form.AppField>

          <form.AppField name="token_budget">
            {(field) => (
              <field.NumberInput
                label="Token Budget"
                helperText="Maximum tokens reserved for activated lore entries"
                placeholder="automatic"
                allowEmpty
                fieldProps={{ flex: 1 }}
              />
            )}
          </form.AppField>
        </Stack>

        <form.AppField name="recursive_scanning">
          {(field) => (
            <field.Switch helperText="Allow activated entries to trigger other entries">
              Recursive Scanning
            </field.Switch>
          )}
        </form.AppField>

        <LorebookExtensionsSection>
          <form.AppField name="extensions">
            {(field) => (
              <field.JsonEditor
                label="Extensions"
                helperText="Store custom metadata consumed by other tools. Leave empty if unused."
                formatOnBlur
                schema={extensionsJsonSchema}
              />
            )}
          </form.AppField>
        </LorebookExtensionsSection>
      </Stack>
    );
  },
});
