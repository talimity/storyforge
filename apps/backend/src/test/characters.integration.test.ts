import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerAssetsRoutes } from "../api/assets.js";
import { getFixtureCount, loadCharacterFixtures, seedCharacterFixtures } from "./fixtures.js";
import { cleanupTestDatabase, createFreshTestCaller, createTestFastifyServer } from "./setup.js";

vi.mock("@storyforge/yolo-onnx");
vi.mock("../services/character/utils/face-detection", async (importOriginal) => ({
  ...((await importOriginal()) as any),
  identifyCharacterFace: vi.fn().mockImplementation(() => ({
    x: 0.5,
    y: 0.3,
    w: 0.5,
    h: 0.5,
    c: 0,
  })),
}));

describe("characters router integration", () => {
  let caller: Awaited<ReturnType<typeof createFreshTestCaller>>["caller"];
  let testDb: Awaited<ReturnType<typeof createFreshTestCaller>>["db"];

  beforeEach(async () => {
    const testContext = await createFreshTestCaller();
    caller = testContext.caller;
    testDb = testContext.db;
  });

  afterEach(async () => {
    cleanupTestDatabase(testDb);
  });

  describe("characters.list", () => {
    it("should return empty list initially", async () => {
      const result = await caller.characters.list();
      expect(result.characters).toHaveLength(0);
    });

    it("should return seeded characters", async () => {
      await seedCharacterFixtures(testDb);
      const fixtureCount = await getFixtureCount();

      const result = await caller.characters.list();
      expect(result.characters).toHaveLength(fixtureCount);
      expect(result.characters[0]).toHaveProperty("id");
      expect(result.characters[0]).toHaveProperty("name");
      expect(result.characters[0]).toHaveProperty("turnCount");
      expect(result.characters[0]).toHaveProperty("isStarred");
      expect(result.characters[0]).toHaveProperty("lastTurnAt");
      // Note: characters.list returns stub objects without description field
    });
  });

  describe("characters.setStarred", () => {
    it("should toggle starred state and filter", async () => {
      const created = await caller.characters.create({
        name: "Starred Hero",
        description: "Testing star toggle",
      });

      await caller.characters.setStarred({ id: created.id, isStarred: true });

      const starredList = await caller.characters.list({ starred: true });
      expect(starredList.characters.find((c) => c.id === created.id)?.isStarred).toBe(true);

      await caller.characters.setStarred({ id: created.id, isStarred: false });
      const clearedList = await caller.characters.list({ starred: true });
      expect(clearedList.characters.find((c) => c.id === created.id)).toBeUndefined();
    });
  });

  describe("characters.getById", () => {
    it("should return character with relations", async () => {
      const fixtures = await seedCharacterFixtures(testDb);
      expect(fixtures.length).toBeGreaterThan(0);

      // Get the first seeded character
      const characters = await caller.characters.list();
      const firstCharacter = characters.characters[0];

      expect(firstCharacter).toBeDefined();
      const result = await caller.characters.getById({
        id: firstCharacter!.id,
      });
      expect(result.id).toBe(firstCharacter!.id);
      expect(result.name).toBe(firstCharacter!.name);
      expect(result).toHaveProperty("starters");
      expect(result).toHaveProperty("examples");
      expect(Array.isArray(result.starters)).toBe(true);
      expect(Array.isArray(result.examples)).toBe(true);
    });

    it("should throw NOT_FOUND for invalid id", async () => {
      await expect(caller.characters.getById({ id: "invalid-id" })).rejects.toThrow(
        "Character not found"
      );
    });
  });

  describe("characters.search", () => {
    it("should return empty list when no characters match", async () => {
      const result = await caller.characters.search({
        name: "NonExistentCharacter",
      });
      expect(result.characters).toHaveLength(0);
    });

    it("should return all characters when name is empty", async () => {
      await seedCharacterFixtures(testDb);

      const result = await caller.characters.search({
        name: "",
      });
      expect(result.characters.length).toBeLessThanOrEqual(10);
      expect(result.characters[0]).toHaveProperty("id");
      expect(result.characters[0]).toHaveProperty("name");
      expect(result.characters[0]).toHaveProperty("imagePath");
      expect(result.characters[0]).toHaveProperty("avatarPath");
      expect(result.characters[0]).toHaveProperty("cardType");
    });

    it("should perform case-insensitive prefix search", async () => {
      await caller.characters.create({
        name: "Alice",
        description: "Test character Alice",
      });
      await caller.characters.create({
        name: "Alicia",
        description: "Test character Alicia",
      });
      await caller.characters.create({
        name: "Bob",
        description: "Test character Bob",
      });

      const result = await caller.characters.search({
        name: "ali",
      });
      expect(result.characters).toHaveLength(2);
      expect(result.characters.map((c: any) => c.name)).toContain("Alice");
      expect(result.characters.map((c: any) => c.name)).toContain("Alicia");

      const result2 = await caller.characters.search({
        name: "ALIC",
      });
      expect(result2.characters).toHaveLength(2);

      const result3 = await caller.characters.search({
        name: "bob",
      });
      expect(result3.characters).toHaveLength(1);
      expect(result3.characters[0]!.name).toBe("Bob");
    });

    it("should return at most 10 characters", async () => {
      for (let i = 1; i <= 12; i++) {
        await caller.characters.create({
          name: `Character ${i.toString().padStart(2, "0")}`,
          description: `Test character ${i}`,
        });
      }

      const result = await caller.characters.search({
        name: "",
      });
      expect(result.characters).toHaveLength(10);
    });

    it("should sort results by name", async () => {
      await caller.characters.create({
        name: "Zebra",
        description: "Test character",
      });
      await caller.characters.create({
        name: "Alpha",
        description: "Test character",
      });
      await caller.characters.create({
        name: "Beta",
        description: "Test character",
      });

      const result = await caller.characters.search({
        name: "",
      });

      const names = result.characters.map((c: any) => c.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it("should include correct asset paths for characters with portraits", async () => {
      const fixtures = await loadCharacterFixtures();
      expect(fixtures.length).toBeGreaterThan(0);
      const fixture = fixtures[0];

      const base64Data = fixture!.buffer.toString("base64");
      const imageDataUri = `data:image/png;base64,${base64Data}`;

      const charWithImage = await caller.characters.create({
        name: "CharacterWithImage",
        description: "Has an image",
        imageDataUri,
      });

      const charWithoutImage = await caller.characters.create({
        name: "CharacterWithoutImage",
        description: "No image",
      });

      const result = await caller.characters.search({
        name: "Character",
      });

      const withImage = result.characters.find((c: any) => c.id === charWithImage.id);
      const withoutImage = result.characters.find((c: any) => c.id === charWithoutImage.id);

      expect(withImage).toBeDefined();
      const expectedCardPrefix = `/assets/characters/${charWithImage.id}/card?cb=`;
      const expectedAvatarPrefix = `/assets/characters/${charWithImage.id}/avatar?cb=`;

      expect(withImage!.imagePath?.startsWith(expectedCardPrefix)).toBe(true);
      expect(withImage!.avatarPath?.startsWith(expectedAvatarPrefix)).toBe(true);

      expect(withoutImage).toBeDefined();
      expect(withoutImage!.imagePath).toBeNull();
      expect(withoutImage!.avatarPath).toBeNull();
    });

    it("should filter by scenarioId when provided", async () => {
      const char1 = await caller.characters.create({
        name: "Character1",
        description: "First character",
      });
      const char2 = await caller.characters.create({
        name: "Character2",
        description: "Second character",
      });
      const char3 = await caller.characters.create({
        name: "Character3",
        description: "Third character",
      });

      const scenario = await caller.scenarios.create({
        name: "Test Scenario",
        description: "Test scenario for filtering",
        status: "active",
        settings: {},
        metadata: {},
        participants: [
          { characterId: char1.id, isUserProxy: false },
          { characterId: char2.id, isUserProxy: false },
        ],
        lorebooks: [],
      });

      const allResults = await caller.characters.search({
        name: "Character",
      });
      expect(allResults.characters).toHaveLength(3);

      const scenarioResults = await caller.characters.search({
        name: "Character",
        filterMode: "inScenario",
        scenarioId: scenario.id,
      });
      expect(scenarioResults.characters).toHaveLength(2);
      const scenarioCharIds = scenarioResults.characters.map((c: any) => c.id);
      expect(scenarioCharIds).toContain(char1.id);
      expect(scenarioCharIds).toContain(char2.id);
      expect(scenarioCharIds).not.toContain(char3.id);

      const specificResult = await caller.characters.search({
        name: "Character1",
        filterMode: "inScenario",
        scenarioId: scenario.id,
      });
      expect(specificResult.characters).toHaveLength(1);
      expect(specificResult.characters[0]!.id).toBe(char1.id);

      const emptyResult = await caller.characters.search({
        name: "Character3",
        filterMode: "inScenario",
        scenarioId: scenario.id,
      });
      expect(emptyResult.characters).toHaveLength(0);
    });

    it("should filter correctly with filterMode='notInScenario'", async () => {
      // Create test characters
      const char1 = await caller.characters.create({
        name: "Alpha",
        description: "First character",
      });
      const char2 = await caller.characters.create({
        name: "Beta",
        description: "Second character",
      });
      const char3 = await caller.characters.create({
        name: "Gamma",
        description: "Third character",
      });
      const char4 = await caller.characters.create({
        name: "Delta",
        description: "Fourth character",
      });

      // Create scenario with char1 and char2
      const scenario = await caller.scenarios.create({
        name: "Test Scenario",
        description: "Test scenario for notInScenario filter",
        status: "active",
        settings: {},
        metadata: {},
        participants: [
          { characterId: char1.id, isUserProxy: false },
          { characterId: char2.id, isUserProxy: false },
        ],
        lorebooks: [],
      });

      // Test filterMode='all' - should return all matching characters
      const allResults = await caller.characters.search({
        name: "",
        filterMode: "all",
      });
      const allIds = allResults.characters.map((c: any) => c.id);
      expect(allIds).toContain(char1.id);
      expect(allIds).toContain(char2.id);
      expect(allIds).toContain(char3.id);
      expect(allIds).toContain(char4.id);

      // Test filterMode='inScenario' - should return only characters in scenario
      const inScenarioResults = await caller.characters.search({
        name: "",
        filterMode: "inScenario",
        scenarioId: scenario.id,
      });
      const inScenarioIds = inScenarioResults.characters.map((c: any) => c.id);
      expect(inScenarioIds).toHaveLength(2);
      expect(inScenarioIds).toContain(char1.id);
      expect(inScenarioIds).toContain(char2.id);
      expect(inScenarioIds).not.toContain(char3.id);
      expect(inScenarioIds).not.toContain(char4.id);

      // Test filterMode='notInScenario' - should return only characters NOT in scenario
      const notInScenarioResults = await caller.characters.search({
        name: "",
        filterMode: "notInScenario",
        scenarioId: scenario.id,
      });
      const notInScenarioIds = notInScenarioResults.characters.map((c: any) => c.id);
      expect(notInScenarioIds).not.toContain(char1.id);
      expect(notInScenarioIds).not.toContain(char2.id);
      expect(notInScenarioIds).toContain(char3.id);
      expect(notInScenarioIds).toContain(char4.id);

      // Test filterMode='notInScenario' with name filter
      const filteredNotInScenario = await caller.characters.search({
        name: "Ga",
        filterMode: "notInScenario",
        scenarioId: scenario.id,
      });
      expect(filteredNotInScenario.characters).toHaveLength(1);
      expect(filteredNotInScenario.characters[0]!.id).toBe(char3.id);

      // Test that characters in the scenario are correctly excluded with name filter
      const excludedInScenario = await caller.characters.search({
        name: "Al",
        filterMode: "notInScenario",
        scenarioId: scenario.id,
      });
      expect(excludedInScenario.characters).toHaveLength(0); // Alpha is in scenario
    });
  });

  describe("characters.create", () => {
    it("should create new character", async () => {
      const newCharacter = {
        name: "Test Character",
        description: "A test character for integration testing",
        legacyPersonality: "Friendly and helpful",
        legacyScenario: "A test scenario",
      };

      const result = await caller.characters.create(newCharacter);
      expect(result.name).toBe(newCharacter.name);
      expect(result.description).toBe(newCharacter.description);
      expect(result.legacyPersonality).toBe(newCharacter.legacyPersonality);
      expect(result.legacyScenario).toBe(newCharacter.legacyScenario);
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("starters");
      expect(result).toHaveProperty("examples");
      expect(Array.isArray(result.starters)).toBe(true);
      expect(Array.isArray(result.examples)).toBe(true);
    });

    it("should create character with minimal data", async () => {
      const newCharacter = {
        name: "Minimal Character",
        description: "Minimal test character",
      };

      const result = await caller.characters.create(newCharacter);
      expect(result.name).toBe(newCharacter.name);
      expect(result.description).toBe(newCharacter.description);
      expect(result).toHaveProperty("id");
    });

    it("should create character with image", async () => {
      const fixtures = await loadCharacterFixtures();
      expect(fixtures.length).toBeGreaterThan(0);
      const fixture = fixtures[0];

      const base64Data = fixture!.buffer.toString("base64");
      const imageDataUri = `data:image/png;base64,${base64Data}`;

      const newCharacter = {
        name: "Character with Avatar",
        description: "Character with image",
        imageDataUri,
      };

      const result = await caller.characters.create(newCharacter);
      expect(result.name).toBe(newCharacter.name);
      expect(result.description).toBe(newCharacter.description);
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("imagePath");

      // Verify that the character was created with an image by checking if we can fetch it
      const fastify = await createTestFastifyServer(testDb);
      registerAssetsRoutes(fastify);

      const response = await fastify.inject({
        method: "GET",
        url: result.imagePath!,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("image/jpeg");
      expect(response.rawPayload).toBeInstanceOf(Buffer);
      expect(response.rawPayload.length).toBeGreaterThan(0);

      await fastify.close();
    });
  });

  describe("characters.update", () => {
    it("should update existing character", async () => {
      const fixtures = await seedCharacterFixtures(testDb);
      expect(fixtures.length).toBeGreaterThan(0);

      const characters = await caller.characters.list();
      const firstCharacter = characters.characters[0];

      const updateData = {
        id: firstCharacter!.id,
        name: "Updated Character Name",
        description: "Updated description",
      };

      const result = await caller.characters.update(updateData);
      expect(result.id).toBe(firstCharacter!.id);
      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(updateData.description);
    });

    it("should throw NOT_FOUND for invalid id", async () => {
      await expect(
        caller.characters.update({
          id: "invalid-id",
          name: "Updated Name",
        })
      ).rejects.toThrow("Character not found");
    });

    it("should update only provided fields", async () => {
      const fixtures = await seedCharacterFixtures(testDb);
      expect(fixtures.length).toBeGreaterThan(0);

      const characters = await caller.characters.list();
      const firstCharacter = characters.characters[0];
      const originalCreatorNotes = firstCharacter!.creatorNotes;

      const updateData = {
        id: firstCharacter!.id,
        name: "Updated Name Only",
      };

      const result = await caller.characters.update(updateData);
      expect(result.name).toBe(updateData.name);
      expect(result.creatorNotes).toBe(originalCreatorNotes); // Should remain unchanged
    });

    it("should clear portrait when imageDataUri is null", async () => {
      const fixtures = await loadCharacterFixtures();
      expect(fixtures.length).toBeGreaterThan(0);

      // Create a character with an image first
      const base64Data = fixtures[0]!.buffer.toString("base64");
      const imageDataUri = `data:image/png;base64,${base64Data}`;

      const created = await caller.characters.create({
        name: "Image Test",
        description: "Has an image to start",
        imageDataUri,
      });

      // Sanity check the image paths exist initially
      const expectedCardPrefix = `/assets/characters/${created.id}/card?cb=`;
      const expectedAvatarPrefix = `/assets/characters/${created.id}/avatar?cb=`;

      expect(created.imagePath?.startsWith(expectedCardPrefix)).toBe(true);
      expect(created.avatarPath?.startsWith(expectedAvatarPrefix)).toBe(true);

      // Now clear the image
      const updated = await caller.characters.update({ id: created.id, imageDataUri: null });

      expect(updated.imagePath).toBeNull();
      expect(updated.avatarPath).toBeNull();
    });
  });

  describe("characters.delete", () => {
    it("should delete existing character", async () => {
      const fixtures = await seedCharacterFixtures(testDb);
      expect(fixtures.length).toBeGreaterThan(0);

      const characters = await caller.characters.list();
      const firstCharacter = characters.characters[0];

      await caller.characters.delete({ id: firstCharacter!.id });

      // Verify character is deleted
      await expect(caller.characters.getById({ id: firstCharacter!.id })).rejects.toThrow(
        "Character not found"
      );

      // Verify list has one less character
      const updatedList = await caller.characters.list();
      expect(updatedList.characters).toHaveLength(fixtures.length - 1);
    });

    it("should throw NOT_FOUND for invalid id", async () => {
      await expect(caller.characters.delete({ id: "invalid-id" })).rejects.toThrow(
        "Character not found"
      );
    });
  });

  describe("Character Image HTTP Endpoint", () => {
    it("should return image buffer for character with image", async () => {
      const fixtures = await seedCharacterFixtures(testDb);
      expect(fixtures.length).toBeGreaterThan(0);

      const characters = await caller.characters.list();
      const characterWithImage = characters.characters.find(
        (character: any) => character.imagePath
      );

      expect(characterWithImage).toBeDefined();
      if (!characterWithImage || typeof characterWithImage.imagePath !== "string") {
        throw new Error("Expected character with an image path");
      }
      const assetUrl = characterWithImage.imagePath;

      const fastify = await createTestFastifyServer(testDb);
      registerAssetsRoutes(fastify);

      const response = await fastify.inject({
        method: "GET",
        url: assetUrl,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("image/jpeg");
      expect(response.rawPayload).toBeInstanceOf(Buffer);
      expect(response.rawPayload.length).toBeGreaterThan(0);
      expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
      expect(response.headers.etag).toBeDefined();

      if (typeof response.headers.etag !== "string") {
        throw new Error("Expected ETag header to be a string");
      }
      const etag = response.headers.etag;
      const conditionalResponse = await fastify.inject({
        method: "GET",
        url: assetUrl,
        headers: { "if-none-match": etag },
      });

      expect(conditionalResponse.statusCode).toBe(304);
      expect(conditionalResponse.headers["cache-control"]).toBe(
        "public, max-age=31536000, immutable"
      );
      expect(conditionalResponse.headers.etag).toBe(etag);

      await fastify.close();
    });

    it("should return original image when q=original", async () => {
      const fixtures = await seedCharacterFixtures(testDb);
      expect(fixtures.length).toBeGreaterThan(0);

      const characters = await caller.characters.list();
      const characterWithImage = characters.characters.find(
        (character: any) => character.imagePath
      );

      expect(characterWithImage).toBeDefined();
      if (!characterWithImage || typeof characterWithImage.imagePath !== "string") {
        throw new Error("Expected character with an image path");
      }
      const assetUrl = `${characterWithImage.imagePath}&q=original`;

      const fastify = await createTestFastifyServer(testDb);
      registerAssetsRoutes(fastify);

      const response = await fastify.inject({
        method: "GET",
        url: assetUrl,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("image/png");
      expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
      expect(response.headers.etag).toBeDefined();

      if (typeof response.headers.etag !== "string") {
        throw new Error("Expected ETag header to be a string");
      }

      const conditionalResponse = await fastify.inject({
        method: "GET",
        url: assetUrl,
        headers: { "if-none-match": response.headers.etag },
      });

      expect(conditionalResponse.statusCode).toBe(304);

      await fastify.close();
    });

    it("should return 404 for invalid id", async () => {
      const fastify = await createTestFastifyServer(testDb);
      registerAssetsRoutes(fastify);

      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/assets/characters/invalid-id/card",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: "Not Found",
        message: "Character or image not found",
        statusCode: 404,
      });

      await fastify.close();
    });

    it("should return 404 for character without image", async () => {
      const newCharacter = await caller.characters.create({
        name: "No Image Character",
        description: "Character without image",
      });

      const fastify = await createTestFastifyServer(testDb);
      registerAssetsRoutes(fastify);

      const response = await fastify.inject({
        method: "GET",
        url: `/assets/characters/${newCharacter.id}/card`,
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: "Not Found",
        message: "Character or image not found",
        statusCode: 404,
      });

      await fastify.close();
    });
  });

  describe("characters.import", () => {
    it("should import character card from base64 PNG data URI", async () => {
      const fixtures = await loadCharacterFixtures();
      expect(fixtures.length).toBeGreaterThan(0);
      const fixture = fixtures[0];

      // Convert the image buffer to base64 data URI
      const base64Data = fixture!.buffer.toString("base64");
      const charaDataUri = `data:image/png;base64,${base64Data}`;

      const result = await caller.characters.import({ charaDataUri });

      expect(result.success).toBe(true);
      expect(result.character).toHaveProperty("id");
      expect(result.character).toHaveProperty("name");
      expect(result.character.name).toBe(fixture!.name);
    });

    it("should throw error for invalid base64 data URI", async () => {
      const invalidDataUri = "data:image/png;base64,invalid-base64-data";

      await expect(caller.characters.import({ charaDataUri: invalidDataUri })).rejects.toThrow();
    });

    it("should throw error for non-image data URI", async () => {
      const textDataUri = "data:text/plain;base64,SGVsbG8gV29ybGQ=";

      await expect(caller.characters.import({ charaDataUri: textDataUri })).rejects.toThrow();
    });

    it("should handle corrupted PNG data gracefully", async () => {
      // Create corrupted PNG data (valid base64 but invalid PNG)
      const corruptedPngData = Buffer.alloc(100, 0).toString("base64");
      const charaDataUri = `data:image/png;base64,${corruptedPngData}`;

      await expect(caller.characters.import({ charaDataUri })).rejects.toThrow(
        "Failed to import character"
      );
    });
  });
});
