import {
  createScenarioSchema,
  scenarioCharacterStartersResponseSchema,
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
  getScenarioCharacterStarters,
  getScenarioDetail,
  listScenarios,
} from "@/library/scenario/scenario.queries";
import { ScenarioService } from "@/library/scenario/scenario.service";
import {
  transformScenarioDetail,
  transformScenarioOverview,
} from "@/library/scenario/scenario.transforms";

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

  getCharacterStarters: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/scenarios/{id}/character-starters",
        tags: ["scenarios"],
        summary: "Get character starters for all characters in a scenario",
      },
    })
    .input(scenarioIdSchema)
    .output(scenarioCharacterStartersResponseSchema)
    .query(async ({ input, ctx }) => {
      try {
        const charactersWithStarters = await getScenarioCharacterStarters(
          ctx.db,
          input.id
        );

        return {
          charactersWithStarters,
        };
      } catch (error) {
        ctx.logger.error(
          error,
          `Error fetching character starters for scenario ${input.id}`
        );
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scenario not found",
        });
      }
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
      const scenarioSvc = new ScenarioService(ctx.db);
      return scenarioSvc.createScenario(input);
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
      const scenarioSvc = new ScenarioService(ctx.db);
      const { id, ...data } = input;

      const scenario = await scenarioSvc.updateScenario(id, data);

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
      const scenarioSvc = new ScenarioService(ctx.db);
      const success = await scenarioSvc.deleteScenario(input.id);

      if (!success) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scenario not found",
        });
      }
    }),
});
