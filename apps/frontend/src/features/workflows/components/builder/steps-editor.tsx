import { Heading, HStack, VStack } from "@chakra-ui/react";
import type { GenStep } from "@storyforge/gentasks";
import { createId } from "@storyforge/utils";
import { useFieldArray, useFormContext } from "react-hook-form";
import { LuListPlus, LuWorkflow } from "react-icons/lu";
import { Button, EmptyState } from "@/components/ui";
import type { WorkflowFormValues } from "./schemas";
import { StepCard } from "./step-card";

export function StepsEditor({ isSubmitting }: { isSubmitting: boolean }) {
  const { control } = useFormContext<WorkflowFormValues>();
  const { fields, append, remove, move, insert } = useFieldArray({ control, name: "steps" });

  const handleAdd = () => {
    const newStep: GenStep = {
      id: createId(),
      name: undefined,
      modelProfileId: "",
      promptTemplateId: "",
      genParams: undefined,
      stop: [],
      maxOutputTokens: undefined,
      maxContextTokens: undefined,
      transforms: [],
      outputs: [{ key: "content", capture: "assistantText" }],
    };
    append(newStep);
  };

  const handleDuplicate = (index: number) => {
    const step = control._formValues.steps?.[index];
    if (!step) return;
    const copy: GenStep = { ...step, id: createId() };
    insert(index + 1, copy);
  };

  return (
    <VStack align="stretch" gap={3}>
      <HStack justify="space-between">
        <Heading size="md">Steps</Heading>
        <Button variant="outline" onClick={handleAdd} disabled={isSubmitting}>
          <LuListPlus />
          Add Step
        </Button>
      </HStack>

      {fields.length === 0 && (
        <EmptyState
          icon={<LuWorkflow />}
          title="No workflow steps yet"
          description="Define the steps in your workflow to generate content."
        />
      )}

      <VStack align="stretch" gap={3}>
        {fields.map((field, idx) => (
          <StepCard
            key={field.id}
            index={idx}
            onRemove={() => remove(idx)}
            onMoveUp={() => idx > 0 && move(idx, idx - 1)}
            onMoveDown={() => idx < fields.length - 1 && move(idx, idx + 1)}
            onDuplicate={() => handleDuplicate(idx)}
            isSubmitting={isSubmitting}
          />
        ))}
      </VStack>
    </VStack>
  );
}
