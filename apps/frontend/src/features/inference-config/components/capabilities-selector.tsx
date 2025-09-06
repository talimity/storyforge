import { HStack, Stack, Text, VStack } from "@chakra-ui/react";
import type { TextInferenceCapabilities } from "@storyforge/inference";
import type * as React from "react";
import { Checkbox, Field, Radio, RadioGroup } from "@/components/ui/index";

export type CapabilitiesValue = Partial<TextInferenceCapabilities>;

export interface CapabilitiesSelectorProps {
  value: CapabilitiesValue;
  onChange: (next: CapabilitiesValue) => void;
  allowInherit?: boolean;
  baseline?: Partial<TextInferenceCapabilities>;
  hide?: Partial<Record<keyof TextInferenceCapabilities, boolean>>;
  helperText?: React.ReactNode;
}

export function CapabilitiesSelector({
  value,
  onChange,
  allowInherit = true,
  baseline,
  hide,
  helperText,
}: CapabilitiesSelectorProps) {
  const set = (k: keyof TextInferenceCapabilities, v: unknown) => {
    onChange({ ...value, [k]: v });
  };
  const clear = (k: keyof TextInferenceCapabilities) => {
    const next = { ...value };
    delete next[k];
    onChange(next);
  };

  return (
    <VStack gap={2} align="stretch">
      {helperText && (
        <Text fontSize="sm" color="content.muted">
          {helperText}
        </Text>
      )}

      <Stack gap={3}>
        {!hide?.streaming && (
          <Field
            label="Streaming responses"
            helperText={
              baseline?.streaming !== undefined
                ? `Effective: ${String(
                    value.streaming ?? baseline.streaming
                  )} ${
                    allowInherit && value.streaming === undefined
                      ? `(inherited)`
                      : ``
                  }`
                : undefined
            }
          >
            {allowInherit ? (
              <RadioGroup
                value={
                  value.streaming === undefined
                    ? "inherit"
                    : value.streaming
                      ? "on"
                      : "off"
                }
                onValueChange={(e) => {
                  if (e.value === "inherit") return clear("streaming");
                  set("streaming", e.value === "on");
                }}
              >
                <HStack gap={4} wrap="wrap">
                  <Radio value="inherit">
                    Inherit
                    {baseline?.streaming !== undefined
                      ? ` (${String(baseline.streaming)})`
                      : ""}
                  </Radio>
                  <Radio value="on">On</Radio>
                  <Radio value="off">Off</Radio>
                </HStack>
              </RadioGroup>
            ) : (
              <Checkbox
                checked={!!value.streaming}
                onCheckedChange={({ checked }) => set("streaming", !!checked)}
              >
                Allow token streaming
              </Checkbox>
            )}
          </Field>
        )}

        {!hide?.assistantPrefill && (
          <Field
            label="Assistant Prefill"
            helperText={
              baseline?.assistantPrefill
                ? `Effective: ${String(
                    value.assistantPrefill ?? baseline.assistantPrefill
                  )} ${
                    allowInherit && value.assistantPrefill === undefined
                      ? `(inherited)`
                      : ``
                  }`
                : "How the provider handles assistant message prefilling"
            }
          >
            <RadioGroup
              value={
                value.assistantPrefill === undefined
                  ? allowInherit
                    ? "inherit"
                    : undefined
                  : value.assistantPrefill
              }
              onValueChange={(e) => {
                if (allowInherit && e.value === "inherit")
                  return clear("assistantPrefill");
                set(
                  "assistantPrefill",
                  e.value as TextInferenceCapabilities["assistantPrefill"]
                );
              }}
            >
              <HStack gap={4} wrap="wrap">
                {allowInherit && (
                  <Radio value="inherit">
                    Inherit
                    {baseline?.assistantPrefill
                      ? ` (${baseline.assistantPrefill})`
                      : ""}
                  </Radio>
                )}
                <Radio value="implicit">Implicit</Radio>
                <Radio value="explicit">Explicit</Radio>
                <Radio value="unsupported">Unsupported</Radio>
              </HStack>
            </RadioGroup>
          </Field>
        )}

        {!hide?.tools && (
          <Field
            label="Tool Calling"
            helperText={
              baseline?.tools !== undefined
                ? `Effective: ${String(value.tools ?? baseline.tools)} ${
                    allowInherit && value.tools === undefined
                      ? `(inherited)`
                      : ``
                  }`
                : undefined
            }
          >
            {allowInherit ? (
              <RadioGroup
                value={
                  value.tools === undefined
                    ? "inherit"
                    : value.tools
                      ? "on"
                      : "off"
                }
                onValueChange={(e) => {
                  if (e.value === "inherit") return clear("tools");
                  set("tools", e.value === "on");
                }}
              >
                <HStack gap={4} wrap="wrap">
                  <Radio value="inherit">
                    Inherit
                    {baseline?.tools !== undefined
                      ? ` (${String(baseline.tools)})`
                      : ""}
                  </Radio>
                  <Radio value="on">On</Radio>
                  <Radio value="off">Off</Radio>
                </HStack>
              </RadioGroup>
            ) : (
              <Checkbox
                checked={!!value.tools}
                onCheckedChange={({ checked }) => set("tools", !!checked)}
              >
                Supports tool use
              </Checkbox>
            )}
          </Field>
        )}

        {!hide?.fim && (
          <Field
            label="Fill-in-the-Middle (FIM)"
            helperText={
              baseline?.fim !== undefined
                ? `Effective: ${String(value.fim ?? baseline.fim)} ${
                    allowInherit && value.fim === undefined ? `(inherited)` : ``
                  }`
                : undefined
            }
          >
            {allowInherit ? (
              <RadioGroup
                value={
                  value.fim === undefined ? "inherit" : value.fim ? "on" : "off"
                }
                onValueChange={(e) => {
                  if (e.value === "inherit") return clear("fim");
                  set("fim", e.value === "on");
                }}
              >
                <HStack gap={4} wrap="wrap">
                  <Radio value="inherit">
                    Inherit
                    {baseline?.fim !== undefined
                      ? ` (${String(baseline.fim)})`
                      : ""}
                  </Radio>
                  <Radio value="on">On</Radio>
                  <Radio value="off">Off</Radio>
                </HStack>
              </RadioGroup>
            ) : (
              <Checkbox
                checked={!!value.fim}
                onCheckedChange={({ checked }) => set("fim", !!checked)}
              >
                Supports FIM
              </Checkbox>
            )}
          </Field>
        )}
      </Stack>
    </VStack>
  );
}
