import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CharacterService } from "../services/character/character-service.js";
import { cleanupTestDatabase, createFreshTestCaller } from "./setup.js";

describe("scenarios router integration", () => {
  let caller: Awaited<ReturnType<typeof createFreshTestCaller>>["caller"];
  let testDb: Awaited<ReturnType<typeof createFreshTestCaller>>["db"];

  let testCharas: Awaited<ReturnType<CharacterService["createCharacter"]>>[];

  beforeEach(async () => {
    const testContext = await createFreshTestCaller();
    caller = testContext.caller;
    testDb = testContext.db;

    // Create test characters
    const charaWriter = new CharacterService(testDb);
    testCharas = [
      await charaWriter.createCharacter({
        characterData: {
          name: "Test Character",
          description: "A test character for integration testing",
        },
      }),
      await charaWriter.createCharacter({
        characterData: {
          name: "Another Test Character",
          description: "Another test character for integration testing",
        },
      }),
    ];
  });

  const scenarioParticipants = (proxyIndex = 0) =>
    testCharas.map((chara, index) => ({
      characterId: chara.id,
      isUserProxy: index === proxyIndex,
    }));

  afterEach(() => {
    cleanupTestDatabase(testDb);
  });

  describe("scenarios.list", () => {
    it("should return empty list initially", async () => {
      const result = await caller.scenarios.list({});
      expect(result.scenarios).toHaveLength(0);
    });

    it("should filter by status", async () => {
      // Create scenarios with different statuses
      await caller.scenarios.create({
        name: "Active Scenario",
        description: "An active scenario",
        status: "active",
        settings: {},
        metadata: {},
        participants: scenarioParticipants(0),
        lorebooks: [],
      });

      await caller.scenarios.create({
        name: "Archived Scenario",
        description: "An archived scenario",
        status: "archived",
        settings: {},
        metadata: {},
        participants: scenarioParticipants(0),
        lorebooks: [],
      });

      // Test filtering by active status
      const activeResult = await caller.scenarios.list({ status: "active" });
      expect(activeResult.scenarios).toHaveLength(1);
      expect(activeResult.scenarios[0]?.name).toBe("Active Scenario");
      expect(activeResult.scenarios[0]?.status).toBe("active");
      expect(activeResult.scenarios[0]).toHaveProperty("turnCount");
      expect(activeResult.scenarios[0]).toHaveProperty("participantCount");
      expect(activeResult.scenarios[0]).toHaveProperty("isStarred");

      // Test filtering by archived status
      const archivedResult = await caller.scenarios.list({
        status: "archived",
      });
      expect(archivedResult.scenarios).toHaveLength(1);
      expect(archivedResult.scenarios[0]?.name).toBe("Archived Scenario");
      expect(archivedResult.scenarios[0]?.status).toBe("archived");

      // Test getting all scenarios
      const allResult = await caller.scenarios.list({});
      expect(allResult.scenarios).toHaveLength(2);
    });
  });

  describe("scenarios.setStarred", () => {
    it("should toggle scenario starred state", async () => {
      const result = await caller.scenarios.create({
        name: "Toggle Scenario",
        description: "Scenario used to test starring",
        status: "active",
        settings: {},
        metadata: {},
        participants: scenarioParticipants(0),
        lorebooks: [],
      });

      await caller.scenarios.setStarred({ id: result.id, isStarred: true });
      const starredList = await caller.scenarios.list({ starred: true });
      expect(starredList.scenarios.find((s) => s.id === result.id)?.isStarred).toBe(true);

      await caller.scenarios.setStarred({ id: result.id, isStarred: false });
      const clearedList = await caller.scenarios.list({ starred: true });
      expect(clearedList.scenarios.find((s) => s.id === result.id)).toBeUndefined();
    });
  });

  describe("scenarios.create", () => {
    it("should create scenario with characters", async () => {
      const newScenario = {
        name: "Test Scenario",
        description: "A test scenario for integration testing",
        status: "active" as const,
        settings: {},
        metadata: {},
        participants: scenarioParticipants(0),
        lorebooks: [],
      };

      const result = await caller.scenarios.create(newScenario);
      expect(result.name).toBe(newScenario.name);
      expect(result.description).toBe(newScenario.description);
      expect(result.status).toBe(newScenario.status);
      expect(result).toHaveProperty("id");

      const scenario = await caller.scenarios.getById({ id: result.id });

      expect(Array.isArray(scenario.characters)).toBe(true);
      expect(scenario.characters).toHaveLength(2);
      expect(scenario.characters[0]!.character.id).toBe(testCharas[0].id);
    });

    it("should not create scenario without characters", async () => {
      const newScenario = {
        name: "Empty Scenario",
        description: "A scenario without characters",
        status: "active" as const,
      };

      await expect(caller.scenarios.create(newScenario)).rejects.toThrow(
        "A scenario must have at least 2 characters."
      );
    });
  });

  describe("scenarios.getById", () => {
    it("should return scenario with characters", async () => {
      const newScenario = await caller.scenarios.create({
        name: "Test Scenario",
        description: "A test scenario",
        status: "active",
        settings: {},
        metadata: {},
        participants: scenarioParticipants(0),
        lorebooks: [],
      });

      const result = await caller.scenarios.getById({ id: newScenario.id });
      expect(result.id).toBe(newScenario.id);
      expect(result.name).toBe(newScenario.name);
      expect(result).toHaveProperty("characters");
      expect(Array.isArray(result.characters)).toBe(true);
      expect(result.characters).toHaveLength(2);
      expect(result.characters[0]!.character.id).toBe(testCharas[0].id);
    });

    it("should throw NOT_FOUND for invalid id", async () => {
      await expect(caller.scenarios.getById({ id: "invalid-id" })).rejects.toThrow(
        "Scenario not found"
      );
    });
  });

  describe("scenarios.update", () => {
    it("should update existing scenario", async () => {
      const newScenario = await caller.scenarios.create({
        name: "Original Name",
        description: "Original description",
        status: "active",
        settings: {},
        metadata: {},
        participants: scenarioParticipants(0),
        lorebooks: [],
      });

      const updateData = {
        id: newScenario.id,
        name: "Updated Name",
        description: "Updated description",
        status: "archived" as const,
        settings: {},
        metadata: {},
        participants: scenarioParticipants(1),
        lorebooks: [],
      };

      const result = await caller.scenarios.update(updateData);
      expect(result.id).toBe(newScenario.id);
      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(updateData.description);
      expect(result.status).toBe(updateData.status);
    });

    it("should throw NOT_FOUND for invalid id", async () => {
      await expect(
        caller.scenarios.update({
          id: "invalid-id",
          name: "Updated Name",
        })
      ).rejects.toThrow("Scenario not found");
    });
  });

  describe("scenarios.delete", () => {
    it("should delete existing scenario", async () => {
      const newScenario = await caller.scenarios.create({
        name: "To Be Deleted",
        description: "This scenario will be deleted",
        status: "active",
        settings: {},
        metadata: {},
        participants: scenarioParticipants(0),
        lorebooks: [],
      });

      await caller.scenarios.delete({ id: newScenario.id });

      // Verify scenario is deleted
      await expect(caller.scenarios.getById({ id: newScenario.id })).rejects.toThrow(
        "Scenario not found"
      );

      // Verify list doesn't contain the deleted scenario
      const scenarios = await caller.scenarios.list({});
      expect(scenarios.scenarios.find((s: any) => s.id === newScenario.id)).toBeUndefined();
    });

    it("should throw NOT_FOUND for invalid id", async () => {
      await expect(caller.scenarios.delete({ id: "invalid-id" })).rejects.toThrow(
        "Scenario not found"
      );
    });
  });
});
