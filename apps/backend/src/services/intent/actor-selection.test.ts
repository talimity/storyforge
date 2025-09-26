import { type SqliteDatabase, schema } from "@storyforge/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "../../test/setup.js";
import { chooseNextActorFair } from "./actor-selection.js";

describe("chooseNextActorFair", () => {
  let db: SqliteDatabase;
  let scenarioId: string;
  let aliceParticipantId: string;
  let bobParticipantId: string;
  let narratorParticipantId: string;
  let siblingCounters: Map<string | null, number>;

  beforeEach(async () => {
    db = await createTestDatabase();
    siblingCounters = new Map();

    const scenarioRow = await db
      .insert(schema.scenarios)
      .values({ name: "Test Scenario", description: "Test", status: "active" })
      .returning({ id: schema.scenarios.id })
      .get();
    scenarioId = scenarioRow.id;

    const characterRows = await db
      .insert(schema.characters)
      .values([
        { name: "Alice", description: "Alice" },
        { name: "Bob", description: "Bob" },
      ])
      .returning({ id: schema.characters.id })
      .all();

    const [aliceCharacter, bobCharacter] = characterRows;
    if (!aliceCharacter || !bobCharacter) {
      throw new Error("Character setup failed");
    }

    const aliceParticipant = await db
      .insert(schema.scenarioParticipants)
      .values({
        scenarioId,
        characterId: aliceCharacter.id,
        type: "character",
        orderIndex: 0,
      })
      .returning({ id: schema.scenarioParticipants.id })
      .get();
    aliceParticipantId = aliceParticipant.id;

    const bobParticipant = await db
      .insert(schema.scenarioParticipants)
      .values({
        scenarioId,
        characterId: bobCharacter.id,
        type: "character",
        orderIndex: 1,
      })
      .returning({ id: schema.scenarioParticipants.id })
      .get();
    bobParticipantId = bobParticipant.id;

    const narratorParticipant = await db
      .insert(schema.scenarioParticipants)
      .values({
        scenarioId,
        type: "narrator",
        orderIndex: 999,
      })
      .returning({ id: schema.scenarioParticipants.id })
      .get();
    narratorParticipantId = narratorParticipant.id;
  });

  it("returns the first participant when no history exists", async () => {
    const nextActor = await chooseNextActorFair(db, scenarioId, {});
    expect(nextActor).toBe(aliceParticipantId);
  });

  it("ignores narrator turns when narrator is not eligible", async () => {
    const aliceTurn = await createTurn(aliceParticipantId, null);
    const narratorTurn = await createTurn(narratorParticipantId, aliceTurn);
    await setAnchor(narratorTurn);

    const nextActor = await chooseNextActorFair(db, scenarioId, {
      leafTurnId: narratorTurn,
    });

    expect(nextActor).toBe(bobParticipantId);
  });

  it("wraps the cycle including narrator when requested", async () => {
    const aliceTurn = await createTurn(aliceParticipantId, null);
    const bobTurn = await createTurn(bobParticipantId, aliceTurn);
    const narratorTurn = await createTurn(narratorParticipantId, bobTurn);
    await setAnchor(narratorTurn);

    const nextActor = await chooseNextActorFair(db, scenarioId, {
      leafTurnId: narratorTurn,
      includeNarrator: true,
    });

    expect(nextActor).toBe(aliceParticipantId);
  });

  it("selects a participant who has not spoken in the current cycle", async () => {
    const aliceTurn = await createTurn(aliceParticipantId, null);
    await setAnchor(aliceTurn);

    const nextActor = await chooseNextActorFair(db, scenarioId, {
      leafTurnId: aliceTurn,
    });

    expect(nextActor).toBe(bobParticipantId);
  });

  it("uses the provided leaf context when branching", async () => {
    const caraCharacter = await db
      .insert(schema.characters)
      .values({ name: "Cara", description: "Cara" })
      .returning({ id: schema.characters.id })
      .get();

    const caraParticipant = await db
      .insert(schema.scenarioParticipants)
      .values({
        scenarioId,
        characterId: caraCharacter.id,
        type: "character",
        orderIndex: 2,
      })
      .returning({ id: schema.scenarioParticipants.id })
      .get();

    const rootTurn = await createTurn(aliceParticipantId, null);
    const branchTurn = await createTurn(bobParticipantId, rootTurn);
    const laterTurn = await createTurn(caraParticipant.id, branchTurn);
    await setAnchor(laterTurn);

    const nextActor = await chooseNextActorFair(db, scenarioId, {
      leafTurnId: branchTurn,
    });

    expect(nextActor).toBe(caraParticipant.id);
  });

  it("handles scenarios with a single eligible participant", async () => {
    await db
      .update(schema.scenarioParticipants)
      .set({ status: "inactive" })
      .where(eq(schema.scenarioParticipants.id, bobParticipantId));

    const nextActor = await chooseNextActorFair(db, scenarioId, {});
    expect(nextActor).toBe(aliceParticipantId);
  });

  async function createTurn(authorId: string, parentTurnId: string | null): Promise<string> {
    const siblingOrder = nextSiblingOrder(parentTurnId);
    const turnRow = await db
      .insert(schema.turns)
      .values({
        scenarioId,
        parentTurnId,
        authorParticipantId: authorId,
        siblingOrder,
      })
      .returning({ id: schema.turns.id })
      .get();

    await db
      .insert(schema.turnLayers)
      .values({ turnId: turnRow.id, key: "presentation", content: `Turn ${turnRow.id}` });

    return turnRow.id;
  }

  function nextSiblingOrder(parentTurnId: string | null): string {
    const key = parentTurnId ?? null;
    const current = siblingCounters.get(key) ?? 0;
    siblingCounters.set(key, current + 1);
    return String.fromCharCode("a".charCodeAt(0) + current);
  }

  async function setAnchor(turnId: string | null) {
    await db
      .update(schema.scenarios)
      .set({ anchorTurnId: turnId })
      .where(eq(schema.scenarios.id, scenarioId));
  }
});
