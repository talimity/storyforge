import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { appContextPlugin } from "../app-context";
import {
  getFixtureCount,
  loadCharacterFixtures,
  seedCharacterFixtures,
} from "../test/fixtures";
import { createFreshTestCaller } from "../test/setup";
import { registerFileUploadRoutes } from "../trpc/file-upload";

describe("characters router integration", () => {
  let caller: ReturnType<typeof createFreshTestCaller>["caller"];
  let testDb: ReturnType<typeof createFreshTestCaller>["db"];

  beforeEach(() => {
    const testContext = createFreshTestCaller();
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
      expect(result.characters[0]).toHaveProperty("description");
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
      expect(result).toHaveProperty("greetings");
      expect(result).toHaveProperty("examples");
      expect(Array.isArray(result.greetings)).toBe(true);
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
      expect(result).toHaveProperty("greetings");
      expect(result).toHaveProperty("examples");
      expect(Array.isArray(result.greetings)).toBe(true);
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
      const originalDescription = firstCharacter!.description;

      const updateData = {
        id: firstCharacter!.id,
        name: "Updated Name Only",
      };

      const result = await caller.characters.update(updateData);
      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(originalDescription); // Should remain unchanged
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

  describe("characters.getImage", () => {
    it("should return image buffer for character with image", async () => {
      const fixtures = await seedCharacterFixtures(testDb);
      expect(fixtures.length).toBeGreaterThan(0);

      const characters = await caller.characters.list();
      const firstCharacter = characters.characters[0];

      const result = await caller.characters.getImage({
        id: firstCharacter!.id,
      });
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should throw NOT_FOUND for invalid id", async () => {
      await expect(
        caller.characters.getImage({ id: "invalid-id" })
      ).rejects.toThrow("Character or image not found");
    });

    it("should throw NOT_FOUND for character without image", async () => {
      // Create character without image
      const newCharacter = await caller.characters.create({
        name: "No Image Character",
        description: "Character without image",
      });

      await expect(
        caller.characters.getImage({ id: newCharacter.id })
      ).rejects.toThrow("Character or image not found");
    });
  });

  describe("HTTP Import Endpoint", () => {
    async function createTestServer() {
      const fastify = Fastify({ logger: false });
      await fastify.register(multipart);
      await fastify.register(appContextPlugin, { db: testDb });
      await registerFileUploadRoutes(fastify);
      return fastify;
    }

    it("should import character card from PNG file", async () => {
      const fixtures = await loadCharacterFixtures();
      expect(fixtures.length).toBeGreaterThan(0);

      const fixture = fixtures[0];
      const fastify = await createTestServer();

      // Create proper multipart form data for file upload
      const FormData = (await import("form-data")).default;
      const form = new FormData();
      form.append("file", fixture!.imageBuffer, {
        filename: "test-character.png",
        contentType: "image/png",
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/api/characters/import",
        payload: form,
        headers: form.getHeaders(),
      });

      if (response.statusCode !== 200) {
        console.log("Import response:", response.statusCode, response.payload);
      }

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(result.character).toHaveProperty("id");
      expect(result.character).toHaveProperty("name");
      expect(result).toHaveProperty("greetings");
      expect(result).toHaveProperty("examples");
      expect(result).toHaveProperty("isV2");
      expect(Array.isArray(result.greetings)).toBe(true);
      expect(Array.isArray(result.examples)).toBe(true);

      await fastify.close();
    });

    it("should reject non-PNG files", async () => {
      const fastify = await createTestServer();

      const response = await fastify.inject({
        method: "POST",
        url: "/api/characters/import",
        payload: Buffer.from("not a png file"),
        headers: {
          "content-type": "text/plain",
        },
      });

      expect(response.statusCode).toBe(406); // Fastify returns 406 for wrong content type

      await fastify.close();
    });

    it("should reject request with no file", async () => {
      const fastify = await createTestServer();

      const response = await fastify.inject({
        method: "POST",
        url: "/api/characters/import",
      });

      expect(response.statusCode).toBe(406); // Fastify returns 406 for missing multipart data

      await fastify.close();
    });

    it("should handle invalid PNG files gracefully", async () => {
      const fastify = await createTestServer();

      // Create a buffer that looks like PNG but has invalid character data
      const invalidPngBuffer = Buffer.alloc(100);
      invalidPngBuffer.write("\x89PNG\r\n\x1a\n", 0); // PNG signature

      const response = await fastify.inject({
        method: "POST",
        url: "/api/characters/import",
        payload: invalidPngBuffer,
        headers: {
          "content-type": "image/png",
        },
      });

      expect(response.statusCode).toBe(415); // Fastify multipart returns 415 for invalid files

      await fastify.close();
    });
  });
});
