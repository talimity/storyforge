import { FastifyInstance } from "fastify";
import { scenarioRepository } from "../repositories";
import { Scenario } from "@storyforge/shared";

interface GetScenarioParams {
  id: string;
}

interface AddTurnBody {
  characterId?: string | null;
  content: string;
  agentData?: {
    plannerOutput?: string;
    screenplayOutput?: string;
    proseOutput?: string;
  };
}

export async function scenariosRoutes(fastify: FastifyInstance) {
  fastify.get("/api/scenarios", async () => {
    try {
      const scenarios = await scenarioRepository.findAllWithRelations();

      const transformedScenarios = scenarios.map((scenario) => ({
        id: scenario.id,
        name: scenario.name,
        description: scenario.description,
        characters: scenario.characterIds,
        turns: [],
      }));

      return { scenarios: transformedScenarios };
    } catch (error) {
      fastify.log.error(error);
      throw new Error("Failed to fetch scenarios");
    }
  });

  fastify.get<{ Params: GetScenarioParams }>(
    "/api/scenarios/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const scenario = await scenarioRepository.findByIdWithRelations(id);

        if (!scenario) {
          return reply.code(404).send({ error: "Scenario not found" });
        }

        const transformedScenario: Scenario = {
          id: scenario.id,
          name: scenario.name,
          description: scenario.description,
          characters: scenario.characterIds,
          turns: scenario.turns.map((turn) => {
            const baseTurn = {
              character: turn.characterId,
              content: turn.content,
              timestamp: turn.timestamp.toISOString(),
            };

            return turn.agentData
              ? { ...baseTurn, agentData: turn.agentData }
              : baseTurn;
          }),
        };

        return transformedScenario;
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to fetch scenario" });
      }
    }
  );

  fastify.post<{ Body: Omit<Scenario, "id"> }>(
    "/api/scenarios",
    async (request, reply) => {
      try {
        const { characters, turns, ...scenarioData } = request.body;

        const newScenario = await scenarioRepository.createWithCharacters(
          {
            name: scenarioData.name,
            description: scenarioData.description,
          },
          characters || []
        );

        if (turns && turns.length > 0) {
          for (const turn of turns) {
            await scenarioRepository.addTurn(newScenario.id, {
              characterId: turn.character,
              content: turn.content,
              timestamp: new Date(turn.timestamp),
              orderIndex: 0,
              agentData: turn.agentData ?? null,
            });
          }
        }

        return reply.code(201).send(newScenario);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to create scenario" });
      }
    }
  );

  fastify.put<{ Params: GetScenarioParams; Body: Partial<Scenario> }>(
    "/api/scenarios/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const { characters, turns, ...scenarioData } = request.body;

        const updateData: Parameters<typeof scenarioRepository.update>[1] = {};

        if (scenarioData.name !== undefined) {
          updateData.name = scenarioData.name;
        }
        if (scenarioData.description !== undefined) {
          updateData.description = scenarioData.description;
        }

        const updatedScenario = await scenarioRepository.update(id, updateData);

        if (!updatedScenario) {
          return reply.code(404).send({ error: "Scenario not found" });
        }

        if (characters !== undefined) {
          await scenarioRepository.updateCharacters(id, characters);
        }

        return updatedScenario;
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to update scenario" });
      }
    }
  );

  fastify.post<{ Params: GetScenarioParams; Body: AddTurnBody }>(
    "/api/scenarios/:id/turns",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const scenario = await scenarioRepository.exists(id);
        if (!scenario) {
          return reply.code(404).send({ error: "Scenario not found" });
        }

        const newTurn = await scenarioRepository.addTurn(id, {
          characterId: request.body.characterId || null,
          content: request.body.content,
          timestamp: new Date(),
          orderIndex: 0,
          agentData: request.body.agentData ?? null,
        });

        return reply.code(201).send(newTurn);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to add turn" });
      }
    }
  );

  fastify.delete<{ Params: GetScenarioParams }>(
    "/api/scenarios/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const deleted = await scenarioRepository.delete(id);

        if (!deleted) {
          return reply.code(404).send({ error: "Scenario not found" });
        }

        return reply.code(204).send();
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to delete scenario" });
      }
    }
  );
}
