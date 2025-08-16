import {
  createScenarioSchema,
  scenarioIdSchema,
  scenarioSchema,
  scenariosWithCharactersListResponseSchema,
  scenarioWithCharactersSchema,
  updateScenarioSchema,
} from "@storyforge/schemas";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "@/api/index";
import {
  getScenarioDetail,
  listScenarios,
} from "@/library/scenario/scenario.queries";
import {
  transformScenarioDetail,
  transformScenarioOverview,
} from "@/library/scenario/scenario.transforms";
import { ScenarioWriterService } from "@/library/scenario/scenario-writer.service";

export const scenariosRouter = router({
  list: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/scenarios",
        tags: ["scenarios"],
        summary: "List scenarios, with participants",
      },
    })
    .input(z.object({ status: z.enum(["active", "archived"]).optional() }))
    .output(scenariosWithCharactersListResponseSchema)
    .query(async ({ input, ctx }) => {
      const scenarios = await listScenarios(ctx.db, { status: input.status });

      return {
        scenarios: scenarios.map(transformScenarioOverview),
      };
    }),

  getById: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/scenarios/{id}",
        tags: ["scenarios"],
        summary: "Get scenario by ID, with participants",
      },
    })
    .input(scenarioIdSchema)
    .output(scenarioWithCharactersSchema)
    .query(async ({ input, ctx }) => {
      const scenario = await getScenarioDetail(ctx.db, input.id);

      if (!scenario) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scenario not found",
        });
      }

      return transformScenarioDetail(scenario);
    }),

  create: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/scenarios",
        tags: ["scenarios"],
        summary: "Create a new scenario",
      },
    })
    .input(createScenarioSchema)
    .output(scenarioSchema)
    .mutation(async ({ input, ctx }) => {
      const scenarioWriter = new ScenarioWriterService(ctx.db);
      return scenarioWriter.createScenario(input);
    }),

  update: publicProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/api/scenarios/{id}",
        tags: ["scenarios"],
        summary: "Update a scenario",
      },
    })
    .input(updateScenarioSchema)
    .output(scenarioSchema)
    .mutation(async ({ input, ctx }) => {
      const scenarioWriter = new ScenarioWriterService(ctx.db);
      const { id, ...data } = input;

      const scenario = await scenarioWriter.updateScenario(id, data);

      if (!scenario) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scenario not found",
        });
      }

      return scenario;
    }),

  delete: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/scenarios/{id}",
        tags: ["scenarios"],
        summary: "Delete a scenario",
      },
    })
    .input(scenarioIdSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const scenarioWriter = new ScenarioWriterService(ctx.db);
      const success = await scenarioWriter.deleteScenario(input.id);

      if (!success) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scenario not found",
        });
      }
    }),
});
