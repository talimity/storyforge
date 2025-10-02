import {
  Card,
  Center,
  createListCollection,
  Heading,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuChevronDown, LuChevronUp, LuRegex, LuScissorsLineDashed, LuTrash } from "react-icons/lu";
import {
  Button,
  InfoTip,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui";
import { withFieldGroup } from "@/lib/app-form";
import type { WorkflowFormValues } from "./form-schemas";

type TransformValues = WorkflowFormValues["steps"][0]["transforms"];
type ApplyTarget = "input" | "output";
type TrimChoice = "start" | "end" | "both";
const applyOptions = createListCollection({
  items: [
    { value: "input", label: "input" },
    { value: "output", label: "output" },
  ] as const,
});

function TransformsInfoTip() {
  return (
    <InfoTip>
      <Text>Allows modifying the input or output of a model call.</Text>
      <Text>
        Input transformations are applied to each chat message in the rendered prompt before it is
        sent to the model.
      </Text>
      <Text>
        Output transformations are applied to the model's full response text, before capturing any
        values.
      </Text>
    </InfoTip>
  );
}

export const TransformsEditor = withFieldGroup({
  defaultValues: { items: [] as TransformValues },
  render: function Render({ group }) {
    return (
      <group.Field name="items" mode="array">
        {(field) => {
          const transforms = field.state.value ?? [];

          const addTrim = () => field.pushValue({ applyTo: "output", trim: "end" });
          const addRegex = () =>
            field.pushValue({
              applyTo: "output",
              regex: { pattern: "", substitution: "", flags: "" },
            });

          return (
            <VStack align="stretch" gap={2}>
              <HStack justify="space-between">
                <HStack gap={1}>
                  <Heading size="sm">Transforms</Heading>
                  <TransformsInfoTip />
                </HStack>
                <HStack gap={2}>
                  <Button size="xs" variant="outline" onClick={addTrim}>
                    <LuScissorsLineDashed />
                    Add Trim
                  </Button>
                  <Button size="xs" variant="outline" onClick={addRegex}>
                    <LuRegex />
                    Add Regex
                  </Button>
                </HStack>
              </HStack>

              {transforms.length === 0 && (
                <Center>
                  <Text fontSize="sm" color="content.muted">
                    No input/output transforms defined.
                  </Text>
                </Center>
              )}

              {transforms.map((transform, i) => {
                const isRegex = Object.hasOwn(transform, "regex");

                return (
                  <Card.Root key={String(i)} p={3} layerStyle="surface.muted">
                    <VStack align="stretch" gap={2}>
                      <HStack justify="space-between">
                        <HStack gap={2}>
                          <Text fontSize="sm" color="content.subtle">
                            {isRegex ? "Regex substitution" : "Trim text"}
                          </Text>
                        </HStack>
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
                            onClick={() => i < transforms.length - 1 && field.moveValue(i, i + 1)}
                          >
                            <LuChevronDown />
                          </IconButton>
                          <IconButton
                            aria-label="Delete"
                            size="xs"
                            variant="ghost"
                            colorPalette="red"
                            onClick={() => field.removeValue(i)}
                          >
                            <LuTrash />
                          </IconButton>
                        </HStack>
                      </HStack>

                      <VStack align="stretch" gap={2}>
                        {!isRegex && (
                          <HStack gap={3}>
                            <group.AppField name={`items[${i}].applyTo`}>
                              {(applyField) => (
                                <applyField.Field label="Apply To" flex={1}>
                                  <SelectRoot
                                    collection={applyOptions}
                                    value={[applyField.state.value ?? "output"]}
                                    onValueChange={(d) =>
                                      applyField.handleChange(
                                        (d.value[0] as ApplyTarget) ?? "output"
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValueText />
                                    </SelectTrigger>
                                    <SelectContent portalled={false}>
                                      {applyOptions.items.map((item) => (
                                        <SelectItem key={item.value} item={item}>
                                          {item.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </SelectRoot>
                                </applyField.Field>
                              )}
                            </group.AppField>
                            <group.AppField name={`items[${i}].trim`}>
                              {(trimField) => {
                                const trimOptions = createListCollection({
                                  items: [
                                    { value: "start", label: "start" },
                                    { value: "end", label: "end" },
                                    { value: "both", label: "both" },
                                  ],
                                });
                                return (
                                  <trimField.Field label="Trim" flex={1}>
                                    <SelectRoot
                                      collection={trimOptions}
                                      value={[trimField.state.value ?? "end"]}
                                      onValueChange={(d) =>
                                        trimField.handleChange(
                                          () => (d.value[0] ?? "end") as TrimChoice
                                        )
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValueText />
                                      </SelectTrigger>
                                      <SelectContent portalled={false}>
                                        {trimOptions.items.map((item) => (
                                          <SelectItem key={item.value} item={item}>
                                            {item.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </SelectRoot>
                                  </trimField.Field>
                                );
                              }}
                            </group.AppField>
                          </HStack>
                        )}

                        {isRegex && (
                          <>
                            <group.AppField name={`items[${i}].regex.pattern`}>
                              {(patternField) => (
                                <patternField.Field label="Pattern">
                                  <Input
                                    value={patternField.state.value ?? ""}
                                    onChange={(event) =>
                                      patternField.handleChange(event.target.value)
                                    }
                                    placeholder="e.g., \\s+$"
                                  />
                                </patternField.Field>
                              )}
                            </group.AppField>
                            <group.AppField name={`items[${i}].regex.flags`}>
                              {(flagsField) => (
                                <flagsField.Field label="Flags">
                                  <Input
                                    value={flagsField.state.value ?? ""}
                                    onChange={(event) =>
                                      flagsField.handleChange(event.target.value)
                                    }
                                    placeholder="gi"
                                  />
                                </flagsField.Field>
                              )}
                            </group.AppField>
                            <group.AppField name={`items[${i}].regex.substitution`}>
                              {(subField) => (
                                <subField.Field label="Substitution">
                                  <Input
                                    value={subField.state.value ?? ""}
                                    onChange={(event) => subField.handleChange(event.target.value)}
                                    placeholder=""
                                  />
                                </subField.Field>
                              )}
                            </group.AppField>
                            <group.AppField name={`items[${i}].applyTo`}>
                              {(applyField) => (
                                <applyField.Field label="Apply To">
                                  <SelectRoot
                                    collection={applyOptions}
                                    value={[applyField.state.value ?? "output"]}
                                    onValueChange={(d) =>
                                      applyField.handleChange(
                                        (d.value[0] as ApplyTarget) ?? "output"
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValueText />
                                    </SelectTrigger>
                                    <SelectContent portalled={false}>
                                      {applyOptions.items.map((item) => (
                                        <SelectItem key={item.value} item={item}>
                                          {item.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </SelectRoot>
                                </applyField.Field>
                              )}
                            </group.AppField>
                          </>
                        )}
                      </VStack>
                    </VStack>
                  </Card.Root>
                );
              })}
            </VStack>
          );
        }}
      </group.Field>
    );
  },
});
