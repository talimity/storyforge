import {
  createIntentInputSchema,
  createIntentOutputSchema,
  intentInterruptInputSchema,
  intentInterruptOutputSchema,
  intentProgressInputSchema,
  intentResultInputSchema,
  intentResultOutputSchema,
} from "@storyforge/contracts";
import { assertDefined } from "@storyforge/utils";
import { ServiceError } from "../../service-error.js";
import { IntentService } from "../../services/intent/intent.service.js";
import { intentRunManager } from "../../services/intent/run-manager.js";
import { TimelineService } from "../../services/timeline/timeline.service.js";
import { WorkflowRunnerManager } from "../../services/workflows/workflow-runner-manager.js";
import { publicProcedure, router } from "../index.js";

export const intentsRouter = router({
  createIntent: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/intents",
        tags: ["intents"],
        summary: "Creates a new intent to influence the story",
      },
    })
    .input(createIntentInputSchema)
    .output(createIntentOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const timeline = new TimelineService(ctx.db);
      const runnerManager = WorkflowRunnerManager.getInstance(ctx.db);
      const runner = runnerManager.getRunner("turn_generation");
      const service = new IntentService(ctx.db, timeline, runner);
      const result = await service.createAndStart({
        scenarioId: input.scenarioId,
        ...input.parameters,
        branchFrom: input.branchFrom,
      });
      return { intentId: result.id };
    }),

  intentProgress: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/intents/{intentId}/subscribe",
        tags: ["intents"],
        summary: "Subscribes to updates on a pending intent's progress",
        enabled: false, // tRPC OpenAPI plugin doesn't support subscriptions
      },
    })
    .input(intentProgressInputSchema)
    .subscription(async function* ({ input, ctx }) {
      const { intentId } = input;
      // todo: move to service

      const intent = await ctx.db.query.intents.findFirst({
        where: { id: intentId },
        columns: { id: true },
      });
      if (!intent) {
        throw new ServiceError("NotFound", {
          message: `Intent with ID ${intentId} not found.`,
        });
      }

      assertDefined(intentRunManager);
      const run = intentRunManager.get(intentId);
      if (!run) {
        throw new ServiceError("NotFound", {
          message: `No active run for intent ${intentId}.`,
        });
      }

      for await (const ev of run.events()) {
        yield ev;
      }
    }),

  intentResult: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/intents/{intentId}",
        tags: ["intents"],
        summary: "Gets the status and results of an intent",
      },
    })
    .input(intentResultInputSchema)
    .output(intentResultOutputSchema)
    .query(async ({ input, ctx }) => {
      const { intentId } = input;
      // todo: move to service
      const intent = await ctx.db.query.intents.findFirst({
        where: { id: intentId },
      });
      if (!intent) {
        throw new ServiceError("NotFound", {
          message: `Intent with ID ${intentId} not found.`,
        });
      }

      const scenario = await ctx.db.query.scenarios.findFirst({
        where: { id: intent.scenarioId },
        columns: { anchorTurnId: true },
      });
      if (!scenario) {
        throw new ServiceError("NotFound", {
          message: `Scenario ${intent.scenarioId} not found.`,
        });
      }

      const effects = await ctx.db.query.intentEffects.findMany({
        where: { intentId },
        columns: {
          intentId: true,
          turnId: true,
          sequence: true,
          kind: true,
          createdAt: true,
        },
        orderBy: (t, { asc }) => [asc(t.createdAt)],
      });

      return {
        id: intent.id,
        scenarioId: intent.scenarioId,
        status: intent.status,
        kind: intent.kind,
        effects,
        // Schema expects non-null string; in practice scenarios will have an anchor by the time
        // results are fetched. Fall back to empty string to satisfy schema.
        anchorTurnId: scenario.anchorTurnId ?? "",
      };
    }),

  interruptIntent: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/intents/intent/{intentId}/interrupt",
        tags: ["intents"],
        summary: "Cancels a running intent",
        enabled: true,
      },
    })
    .input(intentInterruptInputSchema)
    .output(intentInterruptOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const { intentId } = input;
      // todo: move to service
      const intent = await ctx.db.query.intents.findFirst({
        where: { id: intentId },
      });
      if (!intent) {
        throw new ServiceError("NotFound", {
          message: `Intent with ID ${intentId} not found.`,
        });
      }
      if (!intentRunManager) {
        throw new ServiceError("InternalError", {
          message: "Intent run manager is not initialized.",
        });
      }
      const run = intentRunManager.get(intentId);
      if (!run) {
        throw new ServiceError("NotFound", {
          message: `No active run for intent ${intentId}.`,
        });
      }
      run.cancel();
      return { success: true };
    }),
});
