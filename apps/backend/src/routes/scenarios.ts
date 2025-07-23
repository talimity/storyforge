import { FastifyInstance } from "fastify";
import { mockScenarios } from "../data/mockData";
import { Scenario } from "@storyforge/shared";

interface GetScenarioParams {
  id: string;
}

export async function scenariosRoutes(fastify: FastifyInstance) {
  // Get all scenarios
  fastify.get("/api/scenarios", async () => {
    return {
      scenarios: mockScenarios,
    };
  });

  // Get single scenario
  fastify.get<{ Params: GetScenarioParams }>(
    "/api/scenarios/:id",
    async (request, reply) => {
      const { id } = request.params;
      console.log(`Fetching scenario with ID: ${id}`);
      console.log(
        `Available scenarios: ${mockScenarios.map((s) => s.id).join(", ")}`
      );
      const scenario = mockScenarios.find((s) => s.id === id);

      if (!scenario) {
        return reply.code(404).send({ error: "Scenario not found" });
      }

      return scenario;
    }
  );

  // Create scenario
  fastify.post<{ Body: Omit<Scenario, "id"> }>(
    "/api/scenarios",
    async (request, reply) => {
      const newScenario: Scenario = {
        id: `scenario-${Date.now()}`,
        ...request.body,
      };

      mockScenarios.push(newScenario);
      return reply.code(201).send(newScenario);
    }
  );

  // Update scenario
  fastify.put<{ Params: GetScenarioParams; Body: Partial<Scenario> }>(
    "/api/scenarios/:id",
    async (request, reply) => {
      const { id } = request.params;
      const scenarioIndex = mockScenarios.findIndex((s) => s.id === id);

      if (scenarioIndex === -1) {
        return reply.code(404).send({ error: "Scenario not found" });
      }

      const updatedScenario = {
        ...mockScenarios[scenarioIndex],
        ...request.body,
        id, // Ensure ID cannot be changed
      } as Scenario;

      mockScenarios[scenarioIndex] = updatedScenario;
      return updatedScenario;
    }
  );

  // Delete scenario
  fastify.delete<{ Params: GetScenarioParams }>(
    "/api/scenarios/:id",
    async (request, reply) => {
      const { id } = request.params;
      const scenarioIndex = mockScenarios.findIndex((s) => s.id === id);

      if (scenarioIndex === -1) {
        return reply.code(404).send({ error: "Scenario not found" });
      }

      mockScenarios.splice(scenarioIndex, 1);
      return reply.code(204).send();
    }
  );
}
