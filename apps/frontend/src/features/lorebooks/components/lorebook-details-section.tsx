import { Badge, Heading, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { LuBookOpen } from "react-icons/lu";
import { AutosizeTextarea } from "@/components/ui";
import { withForm } from "@/lib/app-form";
import { showErrorToast } from "@/lib/error-handling";
import { lorebookFormDefaultValues } from "./form-schemas";

function stringifyExtensions(value: Record<string, unknown> | undefined) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch (error) {
    console.error("Failed to stringify extensions", error);
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
      title: "Invalid extensions JSON",
      error,
    });
    return undefined;
  }
}

export const LorebookDetailsSection = withForm({
  defaultValues: lorebookFormDefaultValues,
  render: function Render({ form }) {
    return (
      <Stack gap={6}>
        <HStack gap={3}>
          <LuBookOpen size={20} />
          <VStack align="start" gap={0}>
            <Heading size="md">Lorebook Metadata</Heading>
            <Text color="content.muted" fontSize="sm">
              Configure basic metadata and global settings.
            </Text>
          </VStack>
        </HStack>

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

        <Stack gap={2}>
          <HStack gap={2}>
            <Text fontWeight="medium">Extensions</Text>
            <Badge colorPalette="purple" variant="surface">
              Advanced
            </Badge>
          </HStack>
          <Text fontSize="sm" color="content.muted">
            Store custom metadata consumed by other tools. Leave empty if unused.
          </Text>
          <form.AppField name="extensions">
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
                  rows={6}
                  placeholder="{ }"
                />
              );
            }}
          </form.AppField>
        </Stack>
      </Stack>
    );
  },
});
