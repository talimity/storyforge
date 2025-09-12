import {
  Center,
  createListCollection,
  Heading,
  HStack,
  IconButton,
  Input,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { LuChevronDown, LuChevronUp, LuClipboardPen, LuTrash } from "react-icons/lu";
import {
  Button,
  Field,
  InfoTip,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui";
import type { WorkflowFormValues } from "./schemas";

function OutputsInfoTip() {
  return (
    <InfoTip>
      <Stack maxW="300px">
        <Text>
          Captures values from the model's output, which can be used by subsequent steps. The
          workflow's result is a JSON object with captured values from all steps.
        </Text>
        <Text>
          <strong>Note:</strong> A <code>content</code> capture must be present somewhere in the
          workflow.
        </Text>
      </Stack>
    </InfoTip>
  );
}

export function OutputsEditor({ stepIndex, disabled }: { stepIndex: number; disabled: boolean }) {
  const name = `steps.${stepIndex}.outputs` as const;
  const { control, register } = useFormContext<WorkflowFormValues>();
  const { fields, append, remove, move } = useFieldArray({ control, name });

  const captureOptions = createListCollection({
    items: [
      { value: "assistantText", label: "Assistant Text" },
      { value: "jsonParsed", label: "Parsed JSON value" },
    ],
  });

  return (
    <VStack align="stretch" gap={2}>
      <HStack justify="space-between">
        <HStack gap={1}>
          <Heading size="sm">Captured Outputs</Heading>
          <OutputsInfoTip />
        </HStack>
        <Button
          size="xs"
          variant="outline"
          onClick={() => append({ key: "", capture: "assistantText" })}
          disabled={disabled}
        >
          <LuClipboardPen />
          Add Output
        </Button>
      </HStack>
      {fields.length === 0 && (
        <Center>
          <Text fontSize="sm" color="red">
            No model outputs captured.
          </Text>
        </Center>
      )}
      {fields.map((f, i) => {
        const keyPath = `${name}.${i}.key` as const;
        const capPath = `${name}.${i}.capture` as const;
        return (
          <HStack key={f.id} gap={2} align="end">
            <Field label="Key" flex={1}>
              <Input {...register(keyPath)} placeholder="e.g., content" disabled={disabled} />
            </Field>
            <Field label="Captured Value" flex={1}>
              <Controller
                control={control}
                name={capPath}
                render={({ field }) => (
                  <SelectRoot
                    collection={captureOptions}
                    value={[field.value ?? "assistantText"]}
                    onValueChange={(d) => field.onChange(d.value[0])}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValueText />
                    </SelectTrigger>
                    <SelectContent portalled={false}>
                      {captureOptions.items.map((el) => (
                        <SelectItem key={el.value} item={el}>
                          {el.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                )}
              />
            </Field>
            <Controller
              control={control}
              name={capPath}
              render={({ field }) =>
                field.value === "jsonParsed" ? (
                  <Field label="jsonPath" flex={1}>
                    <Controller
                      control={control}
                      name={`${name}.${i}.jsonPath` as const}
                      render={({ field: jsonField }) => (
                        <Input {...jsonField} placeholder="$.path" disabled={disabled} />
                      )}
                    />
                  </Field>
                ) : (
                  <></>
                )
              }
            />
            <HStack gap={1}>
              <IconButton
                aria-label="Up"
                size="xs"
                variant="ghost"
                onClick={() => i > 0 && move(i, i - 1)}
                disabled={disabled}
              >
                <LuChevronUp />
              </IconButton>
              <IconButton
                aria-label="Down"
                size="xs"
                variant="ghost"
                onClick={() => i < fields.length - 1 && move(i, i + 1)}
                disabled={disabled}
              >
                <LuChevronDown />
              </IconButton>
              <IconButton
                aria-label="Remove"
                size="xs"
                variant="ghost"
                colorPalette="red"
                onClick={() => remove(i)}
                disabled={disabled}
              >
                <LuTrash />
              </IconButton>
            </HStack>
          </HStack>
        );
      })}
    </VStack>
  );
}
