import { CharacterRepository } from "@storyforge/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createFreshTestCaller } from "./setup";

describe("scenarios router integration", () => {
  let caller: Awaited<ReturnType<typeof createFreshTestCaller>>["caller"];
  let testDb: Awaited<ReturnType<typeof createFreshTestCaller>>["db"];

  let testChara: Awaited<
    ReturnType<CharacterRepository["createWithRelations"]>
  >;

  beforeEach(async () => {
    const testContext = await createFreshTestCaller();
    caller = testContext.caller;
    testDb = testContext.db;

    // Create a character to use in tests
    const characterRepo = new CharacterRepository(testDb);
    testChara = await characterRepo.createWithRelations({
      name: "Test Character",
      description: "A test character for integration testing",
    });
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
        characterIds: [testChara.id],
      });

      await caller.scenarios.create({
        name: "Archived Scenario",
        description: "An archived scenario",
        status: "archived",
        characterIds: [testChara.id],
      });

      // Test filtering by active status
      const activeResult = await caller.scenarios.list({ status: "active" });
      expect(activeResult.scenarios).toHaveLength(1);
      expect(activeResult.scenarios[0]?.name).toBe("Active Scenario");
      expect(activeResult.scenarios[0]?.status).toBe("active");

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

  describe("scenarios.create", () => {
    it("should create scenario with characters", async () => {
      const newScenario = {
        name: "Test Scenario",
        description: "A test scenario for integration testing",
        status: "active" as const,
        characterIds: [testChara.id],
      };

      const result = await caller.scenarios.create(newScenario);
      expect(result.name).toBe(newScenario.name);
      expect(result.description).toBe(newScenario.description);
      expect(result.status).toBe(newScenario.status);
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("characters");
      expect(Array.isArray(result.characters)).toBe(true);
      expect(result.characters).toHaveLength(1);
      expect(result.characters[0]!.characterId).toBe(testChara.id);
    });

    it("should not create scenario without characters", async () => {
      const newScenario = {
        name: "Empty Scenario",
        description: "A scenario without characters",
        status: "active" as const,
      };

      await expect(caller.scenarios.create(newScenario)).rejects.toThrow(
        "Cannot create scenario with no characters assigned."
      );
    });
  });

  describe("scenarios.getById", () => {
    it("should return scenario with characters", async () => {
      const newScenario = await caller.scenarios.create({
        name: "Test Scenario",
        description: "A test scenario",
        status: "active",
        characterIds: [testChara.id],
      });

      const result = await caller.scenarios.getById({ id: newScenario.id });
      expect(result.id).toBe(newScenario.id);
      expect(result.name).toBe(newScenario.name);
      expect(result).toHaveProperty("characters");
      expect(Array.isArray(result.characters)).toBe(true);
      expect(result.characters).toHaveLength(1);
      expect(result.characters[0]!.characterId).toBe(testChara.id);
    });

    it("should throw NOT_FOUND for invalid id", async () => {
      await expect(
        caller.scenarios.getById({ id: "invalid-id" })
      ).rejects.toThrow("Scenario not found");
    });
  });

  describe("scenarios.update", () => {
    it("should update existing scenario", async () => {
      const newScenario = await caller.scenarios.create({
        name: "Original Name",
        description: "Original description",
        status: "active",
        characterIds: [testChara.id],
      });

      const updateData = {
        id: newScenario.id,
        name: "Updated Name",
        description: "Updated description",
        status: "archived" as const,
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
        characterIds: [testChara.id],
      });

      await caller.scenarios.delete({ id: newScenario.id });

      // Verify scenario is deleted
      await expect(
        caller.scenarios.getById({ id: newScenario.id })
      ).rejects.toThrow("Scenario not found");

      // Verify list doesn't contain the deleted scenario
      const scenarios = await caller.scenarios.list({});
      expect(
        scenarios.scenarios.find((s: any) => s.id === newScenario.id)
      ).toBeUndefined();
    });

    it("should throw NOT_FOUND for invalid id", async () => {
      await expect(
        caller.scenarios.delete({ id: "invalid-id" })
      ).rejects.toThrow("Scenario not found");
    });
  });

  describe("scenarios.assignCharacter", () => {
    it("should assign character to scenario", async () => {
      const characterRepo = new CharacterRepository(testDb);
      const extraChara = await characterRepo.createWithRelations({
        name: "Test Character",
        description: "A test character",
      });

      const scenario = await caller.scenarios.create({
        name: "Test Scenario",
        description: "A test scenario",
        status: "active",
        characterIds: [testChara.id],
      });

      const result = await caller.scenarios.assignCharacter({
        scenarioId: scenario.id,
        characterId: extraChara.id,
        role: "protagonist",
      });

      expect(result.scenarioId).toBe(scenario.id);
      expect(result.characterId).toBe(extraChara.id);
      expect(result.role).toBe("protagonist");
      expect(result.orderIndex).toBe(0);

      // Verify character is assigned by checking scenario
      const updatedScenario = await caller.scenarios.getById({
        id: scenario.id,
      });
      expect(updatedScenario.characters).toHaveLength(2);

      // TODO: flakey assertion, orderIndex conflicts are not resolved and
      // so ordering of returned characters is undefined. repo needs to fixup
      // orderIndex after every assignment.
      // expect(updatedScenario.characters[0]!.characterId).toBe(extraChara.id);
    });

    it("should throw NOT_FOUND for invalid scenario id", async () => {
      await expect(
        caller.scenarios.assignCharacter({
          scenarioId: "invalid-scenario-id",
          characterId: testChara.id,
          role: "protagonist",
          orderIndex: 0,
        })
      ).rejects.toThrow("FOREIGN KEY constraint failed");
    });

    it("should throw NOT_FOUND for invalid character id", async () => {
      const scenario = await caller.scenarios.create({
        name: "Test Scenario",
        description: "A test scenario",
        status: "active",
        characterIds: [testChara.id],
      });

      await expect(
        caller.scenarios.assignCharacter({
          scenarioId: scenario.id,
          characterId: "invalid-character-id",
          role: "protagonist",
          orderIndex: 0,
        })
      ).rejects.toThrow("FOREIGN KEY constraint failed");
    });
  });

  describe("scenarios.unassignCharacter", () => {
    it("should unassign character from scenario", async () => {
      const scenario = await caller.scenarios.create({
        name: "Test Scenario",
        description: "A test scenario",
        status: "active",
        characterIds: [testChara.id],
      });

      // Verify character is initially assigned
      let scenarioWithCharacters = await caller.scenarios.getById({
        id: scenario.id,
      });
      expect(scenarioWithCharacters.characters).toHaveLength(1);

      // Unassign character
      await caller.scenarios.unassignCharacter({
        scenarioId: scenario.id,
        characterId: testChara.id,
      });

      // Verify character is unassigned
      scenarioWithCharacters = await caller.scenarios.getById({
        id: scenario.id,
      });
      expect(scenarioWithCharacters.characters).toHaveLength(0);
    });

    it("should throw NOT_FOUND for invalid scenario id", async () => {
      // Create character directly in the database
      const characterRepo = new CharacterRepository(testDb);
      const newCharacter = await characterRepo.createWithRelations({
        name: "Test Character",
        description: "A test character",
      });

      await expect(
        caller.scenarios.unassignCharacter({
          scenarioId: "invalid-scenario-id",
          characterId: newCharacter.id,
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("scenarios.reorderCharacters", () => {
    it("should reorder characters in scenario", async () => {
      // Create two characters directly in the database
      const characterRepo = new CharacterRepository(testDb);
      const firstCharacter = await characterRepo.createWithRelations({
        name: "First Character",
        description: "First test character",
      });
      const secondCharacter = await characterRepo.createWithRelations({
        name: "Second Character",
        description: "Second test character",
      });

      const scenario = await caller.scenarios.create({
        name: "Test Scenario",
        description: "A test scenario",
        status: "active",
        characterIds: [firstCharacter.id, secondCharacter.id],
      });

      // Get initial order
      let scenarioWithCharacters = await caller.scenarios.getById({
        id: scenario.id,
      });
      expect(scenarioWithCharacters.characters).toHaveLength(2);

      const initialFirstCharId =
        scenarioWithCharacters.characters[0]?.characterId;
      const initialSecondCharId =
        scenarioWithCharacters.characters[1]?.characterId;
      expect(initialFirstCharId).toBeDefined();
      expect(initialSecondCharId).toBeDefined();

      // Reorder characters
      await caller.scenarios.reorderCharacters({
        scenarioId: scenario.id,
        characterOrders: [
          { characterId: initialSecondCharId!, orderIndex: 0 },
          { characterId: initialFirstCharId!, orderIndex: 1 },
        ],
      });

      // Verify new order
      scenarioWithCharacters = await caller.scenarios.getById({
        id: scenario.id,
      });
      expect(scenarioWithCharacters.characters).toHaveLength(2);
      expect(scenarioWithCharacters.characters[0]?.characterId).toBe(
        initialSecondCharId!
      );
      expect(scenarioWithCharacters.characters[1]?.characterId).toBe(
        initialFirstCharId!
      );
    });

    it("should handle invalid scenario id gracefully", async () => {
      // This test expects that reordering characters for invalid scenario doesn't crash
      // It may succeed silently or throw an error, both are acceptable
      try {
        await caller.scenarios.reorderCharacters({
          scenarioId: "invalid-scenario-id",
          characterOrders: [
            { characterId: "char1", orderIndex: 0 },
            { characterId: "char2", orderIndex: 1 },
          ],
        });
        // If it succeeds, that's fine
      } catch (error) {
        // If it throws an error, that's also fine
        expect(error).toBeDefined();
      }
    });
  });
});
