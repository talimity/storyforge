import { Heading, Stack, Text } from "@chakra-ui/react";
import type { GenerationInfoOutput } from "@storyforge/contracts";
import { useStore } from "@tanstack/react-form";
import { useEffect, useMemo } from "react";
import { Switch } from "@/components/ui";
import { intentFormDefaultValues } from "@/features/scenario-player/utils/intent-form";
import { withForm } from "@/lib/app-form";

type ReplaySectionProps = {
  generationInfo?: GenerationInfoOutput | null;
  isLoading: boolean;
  isError: boolean;
  isNotFound: boolean;
  isGenerating: boolean;
};

type ReplayMode = "full" | "resume";

type EditableStep = {
  stepId: string;
  label: string;
  stringOutputs: Array<{ key: string; label: string }>;
  hasNonStringOutputs: boolean;
};

function buildStepLabel(
  generationInfo: GenerationInfoOutput,
  stepId: string,
  orderIndex: number
): string {
  const meta = generationInfo.stepMetadata[stepId];
  const base = meta?.name?.trim() ? meta.name : stepId;
  return `Step ${orderIndex + 1}: ${base}`;
}

function normaliseOverrides(value: unknown): Record<string, Record<string, string>> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const next: Record<string, Record<string, string>> = {};
  for (const [stepId, payload] of Object.entries(record)) {
    if (!payload || typeof payload !== "object") continue;
    const entries: Record<string, string> = {};
    for (const [key, raw] of Object.entries(payload as Record<string, unknown>)) {
      if (typeof raw === "string") entries[key] = raw;
    }
    if (Object.keys(entries).length > 0) next[stepId] = entries;
  }
  return next;
}

// todo: too much imperative logic here & lots of bad re-renders, needs refactor
// don't use this as a reference for tanstack form patterns
export const RetryReplaySection = withForm({
  defaultValues: intentFormDefaultValues,
  props: {
    generationInfo: null,
    isLoading: false,
    isError: false,
    isNotFound: false,
    isGenerating: false,
  } satisfies ReplaySectionProps as ReplaySectionProps,
  render: function Render({ form, generationInfo, isLoading, isError, isNotFound, isGenerating }) {
    const replayMode = useStore(form.store, (state) => state.values.replayMode ?? "full");
    const resumeStepId = useStore(form.store, (state) => state.values.replayResumeStepId ?? null);
    const overrides = useStore(
      form.store,
      (state) => normaliseOverrides(state.values.replayOverrides) ?? {}
    );

    const stepOptions = useMemo(() => {
      if (!generationInfo) return [] as Array<{ value: string; label: string }>;
      return generationInfo.stepOrder
        .map((stepId, index) => ({
          value: stepId,
          label: buildStepLabel(generationInfo, stepId, index),
          index,
        }))
        .filter((entry) => entry.index > 0)
        .map(({ value, label }) => ({ value, label }));
    }, [generationInfo]);

    const editableSteps: EditableStep[] = useMemo(() => {
      if (!generationInfo || replayMode !== "resume" || !resumeStepId) return [];
      const resumeIndex = generationInfo.stepOrder.indexOf(resumeStepId);
      if (resumeIndex <= 0) return [];

      return generationInfo.stepOrder.slice(0, resumeIndex).map((stepId) => {
        const orderIndex = generationInfo.stepOrder.indexOf(stepId);
        const captured = generationInfo.capturedOutputs[stepId] ?? {};
        const stringEntries: Array<{ key: string; label: string }> = [];
        let hasNonStringOutputs = false;
        for (const [key, rawValue] of Object.entries(captured)) {
          if (typeof rawValue === "string") {
            stringEntries.push({ key, label: key });
          } else {
            hasNonStringOutputs = true;
          }
        }
        return {
          stepId,
          label: buildStepLabel(generationInfo, stepId, orderIndex),
          stringOutputs: stringEntries,
          hasNonStringOutputs,
        };
      });
    }, [generationInfo, replayMode, resumeStepId]);

    useEffect(() => {
      const currentOverrides = overrides ?? {};

      if (!generationInfo || stepOptions.length === 0) {
        if (replayMode !== "full") form.setFieldValue("replayMode", "full");
        if (resumeStepId !== null) form.setFieldValue("replayResumeStepId", null);
        if (Object.keys(currentOverrides).length > 0) form.setFieldValue("replayOverrides", {});
        return;
      }

      if (replayMode === "resume") {
        const validResume =
          resumeStepId && stepOptions.some((item) => item.value === resumeStepId)
            ? resumeStepId
            : stepOptions[0]?.value;
        if (validResume && validResume !== resumeStepId) {
          form.setFieldValue("replayResumeStepId", validResume);
          return;
        }
        if (!validResume) {
          form.setFieldValue("replayMode", "full");
          form.setFieldValue("replayResumeStepId", null);
          form.setFieldValue("replayOverrides", {});
          return;
        }

        const resumeIndex = generationInfo.stepOrder.indexOf(validResume);
        const requiredStepIds =
          resumeIndex > 0 ? generationInfo.stepOrder.slice(0, resumeIndex) : [];
        const nextOverrides: Record<string, Record<string, string>> = {};

        for (const stepId of requiredStepIds) {
          const captured = generationInfo.capturedOutputs[stepId];
          if (!captured) continue;
          const stepEntries: Record<string, string> = {};
          for (const [key, rawValue] of Object.entries(captured)) {
            if (typeof rawValue !== "string") continue;
            const existingValue = currentOverrides?.[stepId]?.[key];
            stepEntries[key] = existingValue ?? rawValue;
          }
          if (Object.keys(stepEntries).length > 0) {
            nextOverrides[stepId] = stepEntries;
          }
        }

        if (JSON.stringify(nextOverrides) !== JSON.stringify(currentOverrides)) {
          form.setFieldValue("replayOverrides", nextOverrides);
        }
      } else {
        if (resumeStepId !== null) form.setFieldValue("replayResumeStepId", null);
        if (Object.keys(currentOverrides).length > 0) form.setFieldValue("replayOverrides", {});
      }
    }, [generationInfo, stepOptions, replayMode, resumeStepId, overrides, form]);

    if (!generationInfo && !isLoading && (isNotFound || isError)) {
      if (isNotFound) return null;

      return (
        <Text fontSize="xs" color="fg.error">
          Unable to load previous workflow details.
        </Text>
      );
    }

    if (!generationInfo && !isLoading) {
      return null;
    }

    return (
      <Stack gap={3} borderTopWidth={1} borderTopColor="border" pt={3}>
        <Heading size="sm">Workflow Replay</Heading>
        {isLoading ? (
          <Text fontSize="xs" color="content.muted">
            Loading previous workflow details…
          </Text>
        ) : null}

        {generationInfo ? (
          <Stack gap={3}>
            <form.AppField name="replayMode">
              {(field) => {
                const useCapturedOutputs = field.state.value === "resume";
                const canResume = stepOptions.length > 0;

                return (
                  <field.Field
                    label="Replay Scope"
                    helperText={
                      canResume
                        ? "Reuse captured outputs from earlier steps or regenerate the entire workflow."
                        : "Partial replay isn’t available because only a single step was captured."
                    }
                  >
                    <Switch
                      checked={useCapturedOutputs && canResume}
                      onCheckedChange={(event) => {
                        const nextChecked = Boolean(event.checked);
                        if (nextChecked && !canResume) {
                          field.handleBlur();
                          return;
                        }
                        const nextMode: ReplayMode = nextChecked ? "resume" : "full";
                        field.handleChange(nextMode);
                        if (nextMode === "resume") {
                          const currentResume = form.getFieldValue("replayResumeStepId");
                          const hasCurrent = stepOptions.some(
                            ({ value }) => value === currentResume
                          );
                          if (!hasCurrent) {
                            const fallback = stepOptions[0]?.value;
                            if (fallback) {
                              form.setFieldValue("replayResumeStepId", fallback);
                            }
                          }
                        } else {
                          form.setFieldValue("replayResumeStepId", null);
                          form.setFieldValue("replayOverrides", {});
                        }
                        field.handleBlur();
                      }}
                      disabled={isGenerating || (!canResume && !useCapturedOutputs)}
                    >
                      Reuse previous outputs
                    </Switch>
                  </field.Field>
                );
              }}
            </form.AppField>

            {replayMode === "resume" && stepOptions.length === 0 ? (
              <Text fontSize="xs" color="content.muted">
                This workflow run only captured a single step, so partial replay isn&rsquo;t
                available.
              </Text>
            ) : null}

            {replayMode === "resume" && stepOptions.length > 0 ? (
              <Stack gap={3}>
                <Text fontSize="xs" color="content.muted">
                  Choose the step to regenerate. Earlier steps will reuse the saved outputs below.
                </Text>

                <form.AppField name="replayResumeStepId">
                  {(field) => (
                    <field.Select
                      label="Workflow Step"
                      helperText="Select the first step that should run again."
                      options={stepOptions}
                      allowEmpty={false}
                      placeholder="Select a step"
                      disabled={isGenerating}
                    />
                  )}
                </form.AppField>

                {editableSteps.length > 0 ? (
                  <Stack gap={4} pl={1} pt={1}>
                    {editableSteps.map((step, stepIdx) => (
                      <Stack
                        key={step.stepId}
                        gap={2}
                        pt={stepIdx > 0 ? 3 : 0}
                        borderTopWidth={stepIdx > 0 ? 1 : 0}
                        borderTopColor="border"
                      >
                        <Heading size="xs">{step.label}</Heading>
                        {step.stringOutputs.length > 0 ? (
                          step.stringOutputs.map(({ key, label }) => (
                            <form.AppField
                              key={`${step.stepId}-${key}`}
                              name={`replayOverrides.${step.stepId}.${key}`}
                            >
                              {(field) => (
                                <field.TextareaInput
                                  label={label}
                                  minRows={2}
                                  maxRows={8}
                                  autosize
                                  helperText="Adjust the output passed to later steps."
                                />
                              )}
                            </form.AppField>
                          ))
                        ) : (
                          <Text fontSize="xs" color="content.muted">
                            No editable outputs were captured for this step.
                          </Text>
                        )}
                        {step.hasNonStringOutputs ? (
                          <Text fontSize="xs" color="content.muted">
                            Some outputs from this step are not text and cannot be edited here.
                          </Text>
                        ) : null}
                      </Stack>
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        ) : null}

        {isError && !isLoading && !generationInfo && !isNotFound ? (
          <Text fontSize="xs" color="fg.error">
            Unable to load previous workflow details.
          </Text>
        ) : null}
      </Stack>
    );
  },
});
