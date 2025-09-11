import { createListCollection, HStack, Input, Stack } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { type TaskKind, taskKindSchema } from "@storyforge/gentasks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  Dialog,
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui/index";
import { CharacterSingleSelect } from "@/features/characters/components/character-selector";
import { ScenarioSingleSelect } from "@/features/scenarios/components/scenario-selector";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

const taskOptions = [
  { value: "turn_generation", label: "Turn Generation" },
  { value: "chapter_summarization", label: "Chapter Summarization" },
  { value: "writing_assistant", label: "Writing Assistant" },
] as const;

const scopeOptions = [
  { value: "default", label: "Default" },
  { value: "scenario", label: "Scenario" },
  { value: "character", label: "Character" },
  { value: "participant", label: "Participant" },
] as const;

const baseSchema = z.object({
  task: taskKindSchema,
  workflowId: z.string().min(1, "Workflow is required"),
  scopeKind: z.enum(["default", "scenario", "character", "participant"]),
  scenarioId: z.string().optional(),
  characterId: z.string().optional(),
  participantId: z.string().optional(),
});

const assignmentSchema = baseSchema.refine((vals) => {
  if (vals.scopeKind === "default") return true;
  if (vals.scopeKind === "scenario") return Boolean(vals.scenarioId);
  if (vals.scopeKind === "character") return Boolean(vals.characterId);
  if (vals.scopeKind === "participant") return Boolean(vals.participantId);
  return false;
}, "Target id is required for selected scope kind");

type AssignmentValues = z.infer<typeof assignmentSchema>;

interface AssignmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTask?: TaskKind;
  /** Enables restricted editing: only workflow can change; scope + target are read-only */
  isEditMode?: boolean;
  /** Initial values when editing an existing assignment */
  initialAssignment?: AssignmentValues;
}

export function AssignmentDialog({
  isOpen,
  onOpenChange,
  defaultTask = "turn_generation",
  isEditMode = false,
  initialAssignment,
}: AssignmentDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const upsert = useMutation(
    trpc.workflows.upsertScope.mutationOptions({
      onSuccess: async () => {
        showSuccessToast({ title: "Assignment saved" });
        await queryClient.invalidateQueries(trpc.workflows.listScopes.pathFilter());
        onOpenChange(false);
      },
    })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<AssignmentValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: initialAssignment || { task: defaultTask, scopeKind: "default" },
  });

  // Keep form in sync when switching between create/edit payloads
  // or when dialog is reopened with different item
  const syncDefaults = useCallback(() => {
    reset(initialAssignment || { task: defaultTask, scopeKind: "default" });
  }, [initialAssignment, defaultTask, reset]);

  // Reset values when dialog opens or payload changes
  useEffect(() => {
    if (isOpen) syncDefaults();
  }, [isOpen, syncDefaults]);

  const selectedTask = watch("task");
  const selectedScope = watch("scopeKind");
  const selectedWorkflowId = watch("workflowId");

  // Load workflows for the selected task for the workflow selector
  const workflowsQuery = useQuery(trpc.workflows.list.queryOptions({ task: selectedTask }));
  const workflowCollection = createListCollection({
    items: (workflowsQuery.data?.workflows ?? []).map((wf) => ({
      value: wf.id,
      label: wf.name,
    })),
  });

  const taskCollection = createListCollection({ items: taskOptions });
  const scopeCollection = createListCollection({ items: scopeOptions });

  const onSubmit = (vals: AssignmentValues) => {
    upsert.mutate(vals);
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={({ open }) => onOpenChange(open)}
      placement="center"
      size="lg"
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{isEditMode ? "Edit Assignment" : "New Assignment"}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Stack gap={4}>
            <Field label="Task" required invalid={!!errors.task} errorText={errors.task?.message}>
              <SelectRoot
                collection={taskCollection}
                value={[selectedTask]}
                onValueChange={(d) => setValue("task", d.value[0] as TaskKind)}
                disabled={isEditMode}
              >
                <SelectTrigger>
                  <SelectValueText />
                </SelectTrigger>
                <SelectContent portalled={false}>
                  {taskOptions.map((opt) => (
                    <SelectItem key={opt.value} item={opt}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            </Field>

            <Field
              label="Workflow"
              required
              invalid={!!errors.workflowId}
              errorText={errors.workflowId?.message}
            >
              <SelectRoot
                collection={workflowCollection}
                value={selectedWorkflowId ? [selectedWorkflowId] : []}
                onValueChange={(d) => setValue("workflowId", d.value[0])}
              >
                <SelectTrigger>
                  <SelectValueText
                    placeholder={workflowsQuery.isLoading ? "Loading..." : "Select workflow"}
                  />
                </SelectTrigger>
                <SelectContent portalled={false}>
                  {(workflowsQuery.data?.workflows ?? []).map((wf) => (
                    <SelectItem key={wf.id} item={{ value: wf.id, label: wf.name }}>
                      {wf.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            </Field>

            <HStack gap={3} align="start">
              <Field
                label="Scope"
                required
                invalid={!!errors.scopeKind}
                errorText={errors.scopeKind?.message}
              >
                <SelectRoot
                  collection={scopeCollection}
                  value={[selectedScope]}
                  onValueChange={(d) =>
                    setValue(
                      "scopeKind",
                      d.value[0] as "default" | "scenario" | "character" | "participant"
                    )
                  }
                  disabled={isEditMode}
                >
                  <SelectTrigger>
                    <SelectValueText />
                  </SelectTrigger>
                  <SelectContent portalled={false}>
                    {scopeOptions.map((opt) => (
                      <SelectItem key={opt.value} item={opt}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
              </Field>

              {selectedScope === "scenario" && (
                <Field
                  label="Scenario"
                  required
                  invalid={!!errors.scenarioId}
                  errorText={errors.scenarioId?.message}
                >
                  <ScenarioSingleSelect
                    inDialog
                    value={watch("scenarioId") ?? null}
                    onChange={(id) => setValue("scenarioId", id ?? undefined)}
                    disabled={isEditMode}
                  />
                </Field>
              )}
              {selectedScope === "character" && (
                <Field
                  label="Character"
                  required
                  invalid={!!errors.characterId}
                  errorText={errors.characterId?.message}
                >
                  <CharacterSingleSelect
                    inDialog
                    value={watch("characterId") ?? null}
                    onChange={(id) => setValue("characterId", id ?? undefined)}
                    disabled={isEditMode}
                  />
                </Field>
              )}
              {selectedScope === "participant" && (
                <Field
                  label="Participant ID"
                  required
                  invalid={!!errors.participantId}
                  errorText={errors.participantId?.message}
                >
                  <Input
                    placeholder="participant id"
                    {...register("participantId")}
                    disabled={isEditMode}
                  />
                </Field>
              )}
            </HStack>
          </Stack>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.ActionTrigger asChild>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={upsert.isPending}
            >
              Cancel
            </Button>
          </Dialog.ActionTrigger>
          <Button
            colorPalette="primary"
            onClick={handleSubmit(onSubmit)}
            loading={upsert.isPending}
            disabled={upsert.isPending}
          >
            {isEditMode ? "Save Changes" : "Save Assignment"}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
