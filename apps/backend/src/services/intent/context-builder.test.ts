import { type SqliteDatabase, schema } from "@storyforge/db";
import { createId } from "@storyforge/utils";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTestDatabase, createTestDatabase } from "../../test/setup.js";
import { IntentContextBuilder } from "./context-builder.js";

const SCENARIO_ID = "scenario-test";
const PARTICIPANT_ID = "participant-test";
const CHARACTER_ID = "character-test";

describe("IntentContextBuilder", () => {
  let db: SqliteDatabase;

  beforeEach(async () => {
    db = await createTestDatabase();

    await db.insert(schema.scenarios).values({
      id: SCENARIO_ID,
      name: "Test Scenario",
      description: "Scenario description",
      anchorTurnId: null,
    });

    await db.insert(schema.characters).values({
      id: CHARACTER_ID,
      name: "Hero",
      description: "Brave adventurer",
      cardType: "character",
    });

    await db.insert(schema.scenarioParticipants).values({
      id: PARTICIPANT_ID,
      scenarioId: SCENARIO_ID,
      characterId: CHARACTER_ID,
      type: "character",
      status: "active",
      isUserProxy: true,
    });

    const rootTurnId = createId();
    await db.insert(schema.turns).values({
      id: rootTurnId,
      scenarioId: SCENARIO_ID,
      parentTurnId: null,
      siblingOrder: "m",
      authorParticipantId: PARTICIPANT_ID,
      isGhost: false,
    });
    await db.insert(schema.turnLayers).values({
      turnId: rootTurnId,
      key: "presentation",
      content: "Root turn",
    });

    const ghostTurnId = createId();
    await db.insert(schema.turns).values({
      id: ghostTurnId,
      scenarioId: SCENARIO_ID,
      parentTurnId: rootTurnId,
      siblingOrder: "m",
      authorParticipantId: PARTICIPANT_ID,
      isGhost: true,
    });
    await db.insert(schema.turnLayers).values({
      turnId: ghostTurnId,
      key: "presentation",
      content: "Ghost turn",
    });

    const ghostChildId = createId();
    await db.insert(schema.turns).values({
      id: ghostChildId,
      scenarioId: SCENARIO_ID,
      parentTurnId: ghostTurnId,
      siblingOrder: "m",
      authorParticipantId: PARTICIPANT_ID,
      isGhost: false,
    });
    await db.insert(schema.turnLayers).values({
      turnId: ghostChildId,
      key: "presentation",
      content: "Normal turn",
    });

    await db
      .update(schema.scenarios)
      .set({ anchorTurnId: ghostChildId })
      .where(eq(schema.scenarios.id, SCENARIO_ID));
  });

  afterEach(() => {
    cleanupTestDatabase(db);
  });

  it("excludes ghost turns from the prompt context but preserves numbering", async () => {
    const builder = new IntentContextBuilder(db, SCENARIO_ID);
    const ctx = await builder.buildContext({ actorParticipantId: PARTICIPANT_ID });

    expect(ctx.turns).toHaveLength(2);
    expect(ctx.turns[0].turnNo).toBe(1);
    expect(ctx.turns[0].content).toBe("Root turn");
    expect(ctx.turns.some((turn) => turn.content === "Ghost turn")).toBe(false);
    expect(ctx.nextTurnNumber).toBe(4);
  });
});
