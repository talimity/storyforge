import {
  type GenerationInfoOutput,
  generationInfoMessageSchema,
  generationInfoOutputSchema,
  generationInfoResponseSchema,
} from "@storyforge/contracts";
import type { SqliteDatabase } from "@storyforge/db";
import { ServiceError } from "../../../service-error.js";

export async function getGenerationInfoForTurn(
  db: SqliteDatabase,
  turnId: string
): Promise<GenerationInfoOutput> {
  const run = await db.query.generationRuns.findFirst({
    where: { turnId },
    with: {
      intent: true,
      workflow: true,
      steps: {
        with: {
          modelProfile: true,
          promptTemplate: true,
        },
      },
      participant: {
        with: {
          character: true,
        },
      },
    },
  });

  if (!run) {
    throw new ServiceError("NotFound", {
      message: `No generation data for turn ${turnId}.`,
    });
  }

  const orderedSteps = [...run.steps].sort((a, b) => a.idx - b.idx);

  const prompts: GenerationInfoOutput["prompts"] = {};
  const stepResponses: GenerationInfoOutput["stepResponses"] = {};
  const capturedOutputs: GenerationInfoOutput["capturedOutputs"] = {};
  const apiPayloads: GenerationInfoOutput["apiPayloads"] = {};
  const stepMetadata: GenerationInfoOutput["stepMetadata"] = {};

  for (const step of orderedSteps) {
    const rendered = generationInfoMessageSchema.array().parse(step.promptsRendered ?? []);
    const transformed = step.promptsTransformed
      ? generationInfoMessageSchema.array().parse(step.promptsTransformed)
      : undefined;
    prompts[step.stepId] = {
      rendered,
      transformed: transformed && transformed.length > 0 ? transformed : null,
    };

    if (step.response) {
      stepResponses[step.stepId] = generationInfoResponseSchema.parse(step.response);
    }

    if (step.capturedOutputs && Object.keys(step.capturedOutputs).length > 0) {
      capturedOutputs[step.stepId] = step.capturedOutputs;
    }

    if (step.apiPayload !== undefined && step.apiPayload !== null) {
      apiPayloads[step.stepId] = step.apiPayload;
    }

    stepMetadata[step.stepId] = {
      idx: step.idx,
      name: step.name ?? null,
      promptTemplateId: step.promptTemplateId ?? null,
      promptTemplateName: step.promptTemplate?.name ?? null,
      modelProfileId: step.modelProfileId ?? null,
      modelProfileName: step.modelProfile?.displayName ?? null,
      modelId: step.modelId ?? null,
      hints: step.hints ?? null,
    };
  }

  const participantName =
    run.participant?.character?.name ??
    (run.participant?.type === "narrator" ? "Narrator" : (run.participant?.id ?? "Narrator"));

  return generationInfoOutputSchema.parse({
    workflowId: run.workflowId,
    workflowName: run.workflow?.name ?? null,
    task: "turn_generation" as const,
    stepOrder: run.stepOrder.length > 0 ? run.stepOrder : orderedSteps.map((s) => s.stepId),
    prompts,
    stepResponses,
    capturedOutputs,
    apiPayloads,
    stepMetadata,
    finalOutputs: run.finalOutputs ?? {},
    meta: {
      scenarioId: run.scenarioId,
      participantId: run.participantId,
      participantName,
      intentId: run.intentId,
      intentKind: run.intent?.kind ?? "continue_story",
      intentConstraint: run.intent?.inputText ?? null,
      turnId,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt ?? null,
      error: run.error ?? null,
      effectSequence: run.effectSequence ?? null,
      branchFromTurnId: run.branchFromTurnId ?? null,
    },
  });
}
