import { type SqliteDatabase, schema } from "@storyforge/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "../../test/setup";
import { ScenarioService } from "./scenario.service";

describe("ScenarioService", () => {
  let db: SqliteDatabase;
  let service: ScenarioService;

  beforeEach(async () => {
    db = await createTestDatabase();
    service = new ScenarioService(db);
  });

  describe("participant reconciliation", () => {
    it("should add new participants when updating scenario", async () => {
      // Create test characters
      const [char1, char2, char3] = await db
        .insert(schema.characters)
        .values([
          { name: "Character 1", description: "Test character 1" },
          { name: "Character 2", description: "Test character 2" },
          { name: "Character 3", description: "Test character 3" },
        ])
        .returning();

      // Create scenario with 2 participants
      const scenario = await service.createScenario({
        name: "Test Scenario",
        description: "Test scenario for participant reconciliation",
        status: "active",
        characterIds: [char1.id, char2.id],
      });

      // Update scenario to add a third participant
      await service.updateScenario(scenario.id, {
        participants: [
          { characterId: char1.id, role: "Hero" },
          { characterId: char2.id, role: "Sidekick" },
          { characterId: char3.id, role: "Villain" },
        ],
      });

      // Verify all three participants are active
      const participants = await db
        .select()
        .from(schema.scenarioParticipants)
        .where(eq(schema.scenarioParticipants.scenarioId, scenario.id))
        .all();

      const activeCharacterParticipants = participants.filter(
        (p) => p.type === "character" && p.status === "active"
      );

      expect(activeCharacterParticipants).toHaveLength(3);
      expect(
        activeCharacterParticipants.map((p) => p.characterId).sort()
      ).toEqual([char1.id, char2.id, char3.id].sort());
    });

    it("should remove participants when updating scenario", async () => {
      // Create test characters
      const [char1, char2, char3] = await db
        .insert(schema.characters)
        .values([
          { name: "Character 1", description: "Test character 1" },
          { name: "Character 2", description: "Test character 2" },
          { name: "Character 3", description: "Test character 3" },
        ])
        .returning();

      // Create scenario with 3 participants
      const scenario = await service.createScenario({
        name: "Test Scenario",
        description: "Test scenario for participant removal",
        status: "active",
        characterIds: [char1.id, char2.id, char3.id],
      });

      // Update scenario to remove one participant
      await service.updateScenario(scenario.id, {
        participants: [
          { characterId: char1.id, role: "Hero" },
          { characterId: char2.id, role: "Sidekick" },
        ],
      });

      // Verify only two participants remain (hard delete)
      const participants = await db
        .select()
        .from(schema.scenarioParticipants)
        .where(eq(schema.scenarioParticipants.scenarioId, scenario.id))
        .all();

      const characterParticipants = participants.filter(
        (p) => p.type === "character"
      );

      expect(characterParticipants).toHaveLength(2);
      expect(characterParticipants.map((p) => p.characterId).sort()).toEqual(
        [char1.id, char2.id].sort()
      );

      // Verify the removed participant is completely gone
      const removedParticipant = participants.find(
        (p) => p.characterId === char3.id
      );
      expect(removedParticipant).toBeUndefined();
    });

    it("should update participant roles and user proxy status", async () => {
      // Create test characters
      const [char1, char2] = await db
        .insert(schema.characters)
        .values([
          { name: "Character 1", description: "Test character 1" },
          { name: "Character 2", description: "Test character 2" },
        ])
        .returning();

      // Create scenario with 2 participants
      const scenario = await service.createScenario({
        name: "Test Scenario",
        description: "Test scenario for role updates",
        status: "active",
        characterIds: [char1.id, char2.id],
        userProxyCharacterId: char1.id,
      });

      // Update scenario to change roles and user proxy
      await service.updateScenario(scenario.id, {
        participants: [
          { characterId: char1.id, role: "Protagonist", isUserProxy: false },
          { characterId: char2.id, role: "Antagonist", isUserProxy: true },
        ],
      });

      // Verify roles and user proxy were updated
      const participants = await db
        .select()
        .from(schema.scenarioParticipants)
        .where(eq(schema.scenarioParticipants.scenarioId, scenario.id))
        .all();

      const char1Participant = participants.find(
        (p) => p.characterId === char1.id
      );
      const char2Participant = participants.find(
        (p) => p.characterId === char2.id
      );

      expect(char1Participant?.role).toBe("Protagonist");
      expect(char1Participant?.isUserProxy).toBe(false);
      expect(char2Participant?.role).toBe("Antagonist");
      expect(char2Participant?.isUserProxy).toBe(true);
    });

    it("should prevent removing participants with existing turns", async () => {
      // Create test characters
      const [char1, char2, char3] = await db
        .insert(schema.characters)
        .values([
          { name: "Character 1", description: "Test character 1" },
          { name: "Character 2", description: "Test character 2" },
          { name: "Character 3", description: "Test character 3" },
        ])
        .returning();

      // Create scenario with 3 participants
      const scenario = await service.createScenario({
        name: "Test Scenario",
        description: "Test scenario for turn validation",
        status: "active",
        characterIds: [char1.id, char2.id, char3.id],
      });

      // Get participant IDs
      const participants = await db
        .select()
        .from(schema.scenarioParticipants)
        .where(eq(schema.scenarioParticipants.scenarioId, scenario.id))
        .all();

      const char1Participant = participants.find(
        (p) => p.characterId === char1.id
      );

      // Get the chapter
      const chapter = await db
        .select()
        .from(schema.chapters)
        .where(eq(schema.chapters.scenarioId, scenario.id))
        .get();

      // Create a turn for char1
      if (char1Participant && chapter) {
        await db.insert(schema.turns).values({
          scenarioId: scenario.id,
          chapterId: chapter.id,
          authorParticipantId: char1Participant.id,
          parentTurnId: null,
          siblingOrder: "a",
        });
      }

      // Try to remove char1 (should fail)
      await expect(
        service.updateScenario(scenario.id, {
          participants: [{ characterId: char2.id }, { characterId: char3.id }],
        })
      ).rejects.toThrow("Cannot remove participants with existing turns");

      // Verify all 3 participants are still there
      const remainingParticipants = await db
        .select()
        .from(schema.scenarioParticipants)
        .where(eq(schema.scenarioParticipants.scenarioId, scenario.id))
        .all();

      const characterParticipants = remainingParticipants.filter(
        (p) => p.type === "character"
      );
      expect(characterParticipants).toHaveLength(3);
    });
  });
});
