import {
  assignCharacterSchema,
  createScenarioSchema,
  reorderCharactersSchema,
  scenarioIdSchema,
  scenarioParticipantSchema,
  scenarioSchema,
  scenariosWithCharactersListResponseSchema,
  scenarioWithCharactersSchema,
  unassignCharacterSchema,
  updateScenarioSchema,
} from "@storyforge/api";
import {
  ScenarioParticipantRepository,
  ScenarioRepository,
} from "@storyforge/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  transformScenarioParticipant,
  transformScenarioWithCharacters,
} from "@/shelf/scenario";
import { publicProcedure, router } from "@/trpc/index";

export const scenariosRouter = router({
  list: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/scenarios",
        tags: ["scenarios"],
        summary: "List scenarios with characters",
      },
    })
    .input(z.object({ status: z.enum(["active", "archived"]).optional() }))
    .output(scenariosWithCharactersListResponseSchema)
    .query(async ({ input, ctx }) => {
      const scenarioRepository = new ScenarioRepository(ctx.db);
      let scenarios: Awaited<
        ReturnType<
          | typeof scenarioRepository.findByStatusWithCharacters
          | typeof scenarioRepository.findAllWithCharacters
        >
      >;

      if (input.status) {
        scenarios = await scenarioRepository.findByStatusWithCharacters(
          input.status
        );
      } else {
        scenarios = await scenarioRepository.findAllWithCharacters();
      }

      return { scenarios: scenarios.map(transformScenarioWithCharacters) };
    }),

  getById: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/scenarios/{id}",
        tags: ["scenarios"],
        summary: "Get scenario by ID with characters",
      },
    })
    .input(scenarioIdSchema)
    .output(scenarioWithCharactersSchema)
    .query(async ({ input, ctx }) => {
      const scenarioRepository = new ScenarioRepository(ctx.db);
      const scenario = await scenarioRepository.findByIdWithCharacters(
        input.id
      );

      if (!scenario) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scenario not found",
        });
      }

      return transformScenarioWithCharacters(scenario);
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
    .output(scenarioWithCharactersSchema)
    .mutation(async ({ input, ctx }) => {
      const scenarioRepository = new ScenarioRepository(ctx.db);
      const newScenario = await scenarioRepository.createWithCharacters(input);

      return transformScenarioWithCharacters(newScenario);
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
      const scenarioRepository = new ScenarioRepository(ctx.db);
      const { id, ...updateData } = input;

      const updatedScenario = await scenarioRepository.update(id, updateData);

      if (!updatedScenario) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scenario not found",
        });
      }

      return updatedScenario;
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
      const scenarioRepository = new ScenarioRepository(ctx.db);
      const deleted = await scenarioRepository.delete(input.id);

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scenario not found",
        });
      }
    }),

  assignCharacter: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/scenarios/{scenarioId}/characters/{characterId}",
        tags: ["scenarios"],
        summary: "Assign character to scenario",
      },
    })
    .input(assignCharacterSchema)
    .output(scenarioParticipantSchema)
    .mutation(async ({ input, ctx }) => {
      const participantRepository = new ScenarioParticipantRepository(ctx.db);
      try {
        const participant = await participantRepository.assignCharacter(
          input.scenarioId,
          input.characterId,
          { role: input.role, orderIndex: input.orderIndex }
        );

        return transformScenarioParticipant(participant);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("already assigned")
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Character is already assigned to this scenario",
          });
        }
        if (error instanceof Error && error.message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Scenario or character not found",
          });
        }
        throw error;
      }
    }),

  unassignCharacter: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/scenarios/{scenarioId}/characters/{characterId}",
        tags: ["scenarios"],
        summary: "Unassign character from scenario",
      },
    })
    .input(unassignCharacterSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const participantRepo = new ScenarioParticipantRepository(ctx.db);
      try {
        await participantRepo.unassignCharacter(
          input.scenarioId,
          input.characterId
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
          });
        }
        throw error;
      }
    }),

  reorderCharacters: publicProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/api/scenarios/{scenarioId}/characters/order",
        tags: ["scenarios"],
        summary: "Reorder characters in scenario",
      },
    })
    .input(reorderCharactersSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const participantRepo = new ScenarioParticipantRepository(ctx.db);
      try {
        await participantRepo.reorderCharacters(
          input.scenarioId,
          input.characterOrders
        );
      } catch (_error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to reorder characters",
        });
      }
    }),
});
