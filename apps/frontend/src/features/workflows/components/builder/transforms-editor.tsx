import {
  Card,
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
import { LuChevronDown, LuChevronUp, LuRegex, LuScissorsLineDashed, LuTrash } from "react-icons/lu";
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

function TransformsInfoTip() {
  return (
    <InfoTip>
      <Stack maxW="300px">
        <Text>
          Allows modifying the output of a model call. This runs before outputs are captured.
        </Text>
      </Stack>
    </InfoTip>
  );
}

export function TransformsEditor({
  stepIndex,
  disabled,
}: {
  stepIndex: number;
  disabled: boolean;
}) {
  const name = `steps.${stepIndex}.transforms` as const;
  const { control } = useFormContext<WorkflowFormValues>();
  const { fields, append, remove, move } = useFieldArray({ control, name });

  const addTrim = () => append({ applyTo: "output", trim: "end" });
  const addRegex = () => append({ applyTo: "output", regex: { pattern: "", substitution: "" } });

  return (
    <VStack align="stretch" gap={2}>
      <HStack justify="space-between">
        <HStack gap={1}>
          <Heading size="sm">Transforms</Heading>
          <TransformsInfoTip />
        </HStack>
        <HStack gap={2}>
          <Button size="xs" variant="outline" onClick={addTrim} disabled={disabled}>
            <LuScissorsLineDashed />
            Add Trim
          </Button>
          <Button size="xs" variant="outline" onClick={addRegex} disabled={disabled}>
            <LuRegex />
            Add Regex
          </Button>
        </HStack>
      </HStack>
      {fields.length === 0 && (
        <Center>
          <Text fontSize="sm" color="content.muted">
            No output transforms defined.
          </Text>
        </Center>
      )}
      {fields.map((f, i) => {
        const basePath = `${name}.${i}` as const;
        const isRegex = Object.hasOwn(f, "regex");
        return (
          <Card.Root key={f.id} p={3} layerStyle="surface.muted">
            <VStack align="stretch" gap={2}>
              <HStack justify="space-between">
                <HStack gap={2}>
                  <Text fontSize="sm" color="content.subtle">
                    {isRegex ? "Regex" : "Trim"} transform
                  </Text>
                </HStack>
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
                    aria-label="Delete"
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

              <VStack align="stretch" gap={2}>
                {!isRegex && (
                  <HStack gap={3}>
                    <Field label="Apply To" flex={1}>
                      <Controller
                        control={control}
                        name={`${basePath}.applyTo` as const}
                        render={({ field }) => (
                          <SelectRoot
                            collection={createListCollection({
                              items: [
                                { value: "input", label: "input" },
                                { value: "output", label: "output" },
                              ],
                            })}
                            value={[field.value ?? "output"]}
                            onValueChange={(d) => field.onChange(d.value[0])}
                            disabled={disabled}
                          >
                            <SelectTrigger>
                              <SelectValueText />
                            </SelectTrigger>
                            <SelectContent portalled={false}>
                              <SelectItem item={{ value: "input", label: "input" }}>
                                input
                              </SelectItem>
                              <SelectItem item={{ value: "output", label: "output" }}>
                                output
                              </SelectItem>
                            </SelectContent>
                          </SelectRoot>
                        )}
                      />
                    </Field>
                    <Field label="Trim" flex={1}>
                      <Controller
                        control={control}
                        name={`${basePath}.trim` as const}
                        render={({ field }) => (
                          <SelectRoot
                            collection={createListCollection({
                              items: [
                                { value: "start", label: "start" },
                                { value: "end", label: "end" },
                                { value: "both", label: "both" },
                              ],
                            })}
                            value={[field.value ?? "end"]}
                            onValueChange={(d) => field.onChange(d.value[0])}
                            disabled={disabled}
                          >
                            <SelectTrigger>
                              <SelectValueText />
                            </SelectTrigger>
                            <SelectContent portalled={false}>
                              <SelectItem item={{ value: "start", label: "start" }}>
                                start
                              </SelectItem>
                              <SelectItem item={{ value: "end", label: "end" }}>end</SelectItem>
                              <SelectItem item={{ value: "both", label: "both" }}>both</SelectItem>
                            </SelectContent>
                          </SelectRoot>
                        )}
                      />
                    </Field>
                  </HStack>
                )}

                {isRegex && (
                  <>
                    <HStack gap={3}>
                      <Field label="Pattern" flex={1}>
                        <Controller
                          control={control}
                          name={`${basePath}.regex.pattern` as const}
                          render={({ field }) => (
                            <Input {...field} placeholder="e.g., \\s+$" disabled={disabled} />
                          )}
                        />
                      </Field>
                      <Field label="Flags" flex={0.5}>
                        <Controller
                          control={control}
                          name={`${basePath}.regex.flags` as const}
                          render={({ field }) => (
                            <Input {...field} placeholder="gi" disabled={disabled} />
                          )}
                        />
                      </Field>
                    </HStack>
                    <Field label="Substitution">
                      <Controller
                        control={control}
                        name={`${basePath}.regex.substitution` as const}
                        render={({ field }) => (
                          <Input {...field} placeholder="" disabled={disabled} />
                        )}
                      />
                    </Field>
                    <Field label="Apply To">
                      <Controller
                        control={control}
                        name={`${basePath}.applyTo` as const}
                        render={({ field }) => (
                          <SelectRoot
                            collection={createListCollection({
                              items: [
                                { value: "input", label: "input" },
                                { value: "output", label: "output" },
                              ],
                            })}
                            value={[field.value ?? "output"]}
                            onValueChange={(d) => field.onChange(d.value[0])}
                            disabled={disabled}
                          >
                            <SelectTrigger>
                              <SelectValueText />
                            </SelectTrigger>
                            <SelectContent portalled={false}>
                              <SelectItem item={{ value: "input", label: "input" }}>
                                input
                              </SelectItem>
                              <SelectItem item={{ value: "output", label: "output" }}>
                                output
                              </SelectItem>
                            </SelectContent>
                          </SelectRoot>
                        )}
                      />
                    </Field>
                  </>
                )}
              </VStack>
            </VStack>
          </Card.Root>
        );
      })}
    </VStack>
  );
}
