import { beforeEach, describe, expect, it } from "vitest";
import { registerAssetsRoutes } from "../api/assets";
import {
  getFixtureCount,
  loadCharacterFixtures,
  seedCharacterFixtures,
} from "../test/fixtures";
import { createFreshTestCaller, createTestFastifyServer } from "../test/setup";

describe("characters router integration", () => {
  let caller: Awaited<ReturnType<typeof createFreshTestCaller>>["caller"];
  let testDb: Awaited<ReturnType<typeof createFreshTestCaller>>["db"];

  beforeEach(async () => {
    const testContext = await createFreshTestCaller();
    caller = testContext.caller;
    testDb = testContext.db;
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
      // Note: characters.list returns stub objects without description field
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
      await expect(
        caller.characters.getById({ id: "invalid-id" })
      ).rejects.toThrow("Character not found");
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
      expect(response.headers["content-type"]).toBe("image/png");
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
  });

  describe("characters.delete", () => {
    it("should delete existing character", async () => {
      const fixtures = await seedCharacterFixtures(testDb);
      expect(fixtures.length).toBeGreaterThan(0);

      const characters = await caller.characters.list();
      const firstCharacter = characters.characters[0];

      await caller.characters.delete({ id: firstCharacter!.id });

      // Verify character is deleted
      await expect(
        caller.characters.getById({ id: firstCharacter!.id })
      ).rejects.toThrow("Character not found");

      // Verify list has one less character
      const updatedList = await caller.characters.list();
      expect(updatedList.characters).toHaveLength(fixtures.length - 1);
    });

    it("should throw NOT_FOUND for invalid id", async () => {
      await expect(
        caller.characters.delete({ id: "invalid-id" })
      ).rejects.toThrow("Character not found");
    });
  });

  describe("Character Image HTTP Endpoint", () => {
    it("should return image buffer for character with image", async () => {
      const fixtures = await seedCharacterFixtures(testDb);
      expect(fixtures.length).toBeGreaterThan(0);

      const characters = await caller.characters.list();
      const firstCharacter = characters.characters[0];

      const fastify = await createTestFastifyServer(testDb);
      registerAssetsRoutes(fastify);

      const response = await fastify.inject({
        method: "GET",
        url: `/assets/characters/${firstCharacter!.id}/card`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("image/png");
      expect(response.rawPayload).toBeInstanceOf(Buffer);
      expect(response.rawPayload.length).toBeGreaterThan(0);

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

    it.only("should return 404 for character without image", async () => {
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

      await expect(
        caller.characters.import({ charaDataUri: invalidDataUri })
      ).rejects.toThrow();
    });

    it("should throw error for non-image data URI", async () => {
      const textDataUri = "data:text/plain;base64,SGVsbG8gV29ybGQ=";

      await expect(
        caller.characters.import({ charaDataUri: textDataUri })
      ).rejects.toThrow();
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
