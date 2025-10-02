import { type TaskKind, taskKindSchema } from "@storyforge/gentasks";
import { z } from "zod";
import { init } from "zod-empty";

const baseAssignmentSchema = z.object({
  task: taskKindSchema,
  workflowId: z.string().min(1, "Workflow is required"),
  scopeKind: z.enum(["default", "scenario", "character", "participant"]),
  scenarioId: z.string().optional(),
  characterId: z.string().optional(),
  participantId: z.string().optional(),
});

export const assignmentFormSchema = baseAssignmentSchema.superRefine((values, ctx) => {
  if (values.scopeKind === "default") {
    return;
  }

  if (values.scopeKind === "scenario" && !values.scenarioId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scenarioId"],
      message: "Scenario is required",
    });
    return;
  }

  if (values.scopeKind === "character" && !values.characterId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["characterId"],
      message: "Character is required",
    });
    return;
  }

  if (values.scopeKind === "participant" && !values.participantId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["participantId"],
      message: "Participant ID is required",
    });
  }
});

export const assignmentFormDefaultValues = init(assignmentFormSchema);

export type AssignmentFormValues = z.infer<typeof assignmentFormSchema> & {
  task: TaskKind;
};
