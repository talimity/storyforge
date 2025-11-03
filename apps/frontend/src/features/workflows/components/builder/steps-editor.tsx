import { Stack, VStack } from "@chakra-ui/react";
import { createId } from "@storyforge/utils";
import { LuListOrdered, LuListPlus } from "react-icons/lu";
import { Button, EmptyState } from "@/components/ui";
import { TabHeader } from "@/components/ui/tab-header";
import { withForm } from "@/lib/form/app-form";
import { workflowFormDefaultValues } from "./form-schemas";
import { StepCard } from "./step-card";

export const StepsEditor = withForm({
  defaultValues: workflowFormDefaultValues,
  render: function Render({ form }) {
    return (
      <form.AppField name="steps" mode="array">
        {(stepsField) => {
          const handleAdd = () => {
            const newStep = {
              id: createId(),
              name: undefined,
              modelProfileId: "",
              promptTemplateId: "",
              genParams: undefined,
              stop: [],
              maxOutputTokens: undefined,
              maxContextTokens: undefined,
              transforms: [],
              outputs: [{ key: "content", capture: "assistantText" } as const],
            };
            stepsField.pushValue(newStep);
          };

          const handleDuplicate = (index: number) => {
            const source = stepsField.state.value[index];
            if (!source) return;
            const clone = { ...source, id: createId() };
            stepsField.pushValue(clone);
          };

          return (
            <Stack gap={6}>
              <TabHeader
                title="Workflow Steps"
                description="Configure content generation steps"
                icon={LuListOrdered}
                actions={
                  <Button variant="outline" onClick={handleAdd}>
                    <LuListPlus />
                    Add Step
                  </Button>
                }
              />

              {stepsField.state.value.length === 0 ? (
                <EmptyState
                  icon={<LuListOrdered />}
                  title="No workflow steps yet"
                  description="Define the steps in your workflow to generate content."
                />
              ) : (
                <VStack align="stretch" gap={3}>
                  {stepsField.state.value.map((_step, idx) => (
                    <StepCard
                      task={form.state.values.task}
                      // for array fields, key MUST be the index. any other key will cause crashes
                      // when removing items from the array, as there will be one render tick where
                      // group.store.values becomes undefined before the component is unmounted.
                      // see https://github.com/TanStack/form/issues/1561
                      // biome-ignore lint/suspicious/noArrayIndexKey: TODO remove after https://github.com/TanStack/form/pull/1729
                      key={/*step.id ??*/ idx}
                      form={form}
                      fields={`steps[${idx}]`}
                      index={idx}
                      onRemove={() => stepsField.removeValue(idx)}
                      onMoveUp={() => idx > 0 && stepsField.moveValue(idx, idx - 1)}
                      onMoveDown={() =>
                        idx < stepsField.state.value.length - 1 &&
                        stepsField.moveValue(idx, idx + 1)
                      }
                      onDuplicate={() => handleDuplicate(idx)}
                    />
                  ))}
                </VStack>
              )}
            </Stack>
          );
        }}
      </form.AppField>
    );
  },
});
