import { Center, Code, Heading, HStack, IconButton, Text, VStack } from "@chakra-ui/react";

import { LuChevronDown, LuChevronUp, LuClipboardPen, LuTrash } from "react-icons/lu";
import { Button, InfoTip } from "@/components/ui";
import { withFieldGroup } from "@/lib/form/app-form";
import type { WorkflowFormValues } from "./form-schemas";

function OutputsInfoTip() {
  return (
    <InfoTip>
      <Text>
        Captures values from the model's response and saves them using the specified name. The
        workflow's final result is a JSON object with captured values from all steps.
      </Text>
      <Text>
        Prompt templates in subsequent steps can reference captured values using the{" "}
        <Code size="xs">{`
          {{stepOutput}}
        `}</Code>{" "}
        macro, e.g., <Code size="xs">{`{{stepOutput.content}}`}</Code>.
      </Text>
      <Text>
        <strong>Note:</strong> A <Code size="xs">content</Code> capture should be present somewhere
        in the workflow, otherwise tasks using this workflow may not work as expected.
      </Text>
    </InfoTip>
  );
}

type OutputValues = WorkflowFormValues["steps"][0]["outputs"];
const captureOptions = [
  { value: "assistantText", label: "Assistant text" },
  { value: "jsonParsed", label: "Parsed JSON value" },
];

export const OutputsEditor = withFieldGroup({
  defaultValues: { items: [] as OutputValues },
  render: function Render({ group }) {
    return (
      <group.Field name="items" mode="array">
        {(field) => {
          const outputs = field.state.value ?? [];

          const handleAdd = () => field.pushValue({ key: "", capture: "assistantText" });

          return (
            <VStack align="stretch" gap={2}>
              <HStack justify="space-between">
                <HStack gap={1}>
                  <Heading size="sm">Captured Outputs</Heading>
                  <OutputsInfoTip />
                </HStack>
                <Button size="xs" variant="outline" onClick={handleAdd}>
                  <LuClipboardPen />
                  Add Output
                </Button>
              </HStack>
              {outputs.length === 0 && (
                <Center>
                  <Text fontSize="sm" color="red">
                    No model outputs captured.
                  </Text>
                </Center>
              )}
              {outputs.map((output, i) => {
                const basePath = `items[${i}]` as const;
                return (
                  <HStack key={String(i)} gap={2} align="end">
                    <group.AppField name={`${basePath}.key`}>
                      {(keyField) => (
                        <keyField.TextInput
                          label="Key"
                          placeholder="e.g., content"
                          fieldProps={{ flex: 1 }}
                        />
                      )}
                    </group.AppField>

                    <group.AppField name={`${basePath}.capture`}>
                      {(captureField) => (
                        <captureField.Select
                          label="Captured Value"
                          options={captureOptions}
                          fieldProps={{ flex: 1 }}
                        />
                      )}
                    </group.AppField>

                    {output?.capture === "jsonParsed" ? (
                      <group.AppField name={`${basePath}.jsonPath`}>
                        {(jsonField) => (
                          <jsonField.TextInput
                            label="JSON Path"
                            placeholder="$.path"
                            fieldProps={{ flex: 1.5 }}
                          />
                        )}
                      </group.AppField>
                    ) : (
                      <div style={{ flex: 1.5 }} />
                    )}

                    <HStack gap={1}>
                      <IconButton
                        aria-label="Up"
                        size="xs"
                        variant="ghost"
                        onClick={() => i > 0 && field.moveValue(i, i - 1)}
                      >
                        <LuChevronUp />
                      </IconButton>
                      <IconButton
                        aria-label="Down"
                        size="xs"
                        variant="ghost"
                        onClick={() => i < outputs.length - 1 && field.moveValue(i, i + 1)}
                      >
                        <LuChevronDown />
                      </IconButton>
                      <IconButton
                        aria-label="Remove"
                        size="xs"
                        variant="ghost"
                        colorPalette="red"
                        onClick={() => field.removeValue(i)}
                      >
                        <LuTrash />
                      </IconButton>
                    </HStack>
                  </HStack>
                );
              })}
            </VStack>
          );
        }}
      </group.Field>
    );
  },
});
