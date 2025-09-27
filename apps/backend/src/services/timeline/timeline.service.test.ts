import { type SqliteDatabase, schema, type Turn } from "@storyforge/db";
import { createId, ranksBetween } from "@storyforge/utils";
import { eq, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "../../test/setup.js";
import { TimelineService } from "./timeline.service.js";

const TEST_SCENARIO_ID = "test-scenario";
const TEST_PARTICIPANT_ID = "test-participant";

const RANKS = ranksBetween("", "", 5);

async function createTurn(
  db: SqliteDatabase,
  opts: { parent?: string | null; siblingOrder?: string }
): Promise<Turn> {
  const id = createId();
  const turn = await db
    .insert(schema.turns)
    .values({
      id,
      scenarioId: TEST_SCENARIO_ID,
      parentTurnId: opts.parent ?? null,
      siblingOrder: opts.siblingOrder ?? RANKS[0],
      authorParticipantId: TEST_PARTICIPANT_ID,
    })
    .returning()
    .get();

  await db
    .insert(schema.turnLayers)
    .values({ turnId: id, key: "presentation", content: `Turn ${id}` });

  return turn;
}

describe("TimelineService.deleteTurn", () => {
  let db: SqliteDatabase;
  let service: TimelineService;

  beforeEach(async () => {
    db = await createTestDatabase();
    service = new TimelineService(db);
    await db.insert(schema.scenarios).values({
      id: TEST_SCENARIO_ID,
      name: "Test Scenario",
      description: "A scenario for testing",
      anchorTurnId: null,
    });
    await db
      .insert(schema.scenarioParticipants)
      .values({ id: TEST_PARTICIPANT_ID, scenarioId: TEST_SCENARIO_ID });
  });

  describe("cascade deletion", () => {
    it("deletes a leaf turn", async () => {
      // Setup: A -> B -> C
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id });
      const c = await createTurn(db, { parent: b.id });

      await service.deleteTurn(c.id, true);

      // Assert C is gone
      const remaining = await db.select().from(schema.turns);
      expect(remaining.map((t) => t.id)).toEqual([a.id, b.id]);
    });

    it("deletes a subtree", async () => {
      //       A
      //      / \
      //     B   C
      //    / \
      //   D   E
      //  /
      // F
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id });
      const c = await createTurn(db, { parent: a.id, siblingOrder: "n" });
      const d = await createTurn(db, { parent: b.id });
      /* e */ await createTurn(db, { parent: b.id, siblingOrder: "n" });
      /* f */ await createTurn(db, { parent: d.id });

      await service.deleteTurn(b.id, true);

      // B, D, E, F should be gone; A, C remain
      const remaining = await getTurnIds(db);
      expect(remaining).toEqual([a.id, c.id]);

      // C be the only child of A
      const children = await getTurnsByParent(db, a.id);
      expect(children.map((t) => t.id)).toEqual([c.id]);
    });

    it("deletes the only turn in a scenario", async () => {
      const a = await createTurn(db, { parent: null });
      await setAnchor(db, TEST_SCENARIO_ID, a.id);

      await service.deleteTurn(a.id, true);

      const remaining = await getTurnIds(db);
      expect(remaining).toEqual([]);

      const scenario = await db.query.scenarios.findFirst({
        where: { id: TEST_SCENARIO_ID },
      });
      expect(scenario!.anchorTurnId).toBeNull();
    });

    it("updates anchor when deleting anchor turn", async () => {
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id });
      await setAnchor(db, TEST_SCENARIO_ID, b.id);

      await service.deleteTurn(b.id, true);

      const scenario = await db.query.scenarios.findFirst({
        where: { id: TEST_SCENARIO_ID },
      });
      expect(scenario!.anchorTurnId).toBe(a.id);
    });

    it("finds leaf when setting new anchor that has children", async () => {
      // When deleting an anchor and the new proposed anchor has children,
      // we must traverse down to find the actual leaf
      //       A
      //      / \
      //     B   C    <- current anchor
      //   / | \
      //  D  E  F      <- D should become the new anchor (first child path leaf)
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id, siblingOrder: RANKS[0] });
      const c = await createTurn(db, { parent: a.id, siblingOrder: RANKS[1] });
      const d = await createTurn(db, { parent: b.id, siblingOrder: RANKS[0] });
      /* e */ await createTurn(db, { parent: b.id, siblingOrder: RANKS[1] });
      /* f */ await createTurn(db, { parent: b.id, siblingOrder: RANKS[2] });
      await setAnchor(db, TEST_SCENARIO_ID, c.id);

      // Delete C (the anchor). B would be set as new anchor, but it has children
      // So the actual anchor should be D (first child in the path)
      await service.deleteTurn(c.id, true);

      const scenario = await db.query.scenarios.findFirst({
        where: { id: TEST_SCENARIO_ID },
      });
      // Should find D as the leaf (following first child path from B)
      expect(scenario!.anchorTurnId).toBe(d.id);
    });

    it("preserves order of remaining siblings", async () => {
      //       A
      //    / | | \
      //   B  C D  E
      //      |
      //      F
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id, siblingOrder: "m" });
      const c = await createTurn(db, { parent: a.id, siblingOrder: "n" });
      const d = await createTurn(db, { parent: a.id, siblingOrder: "o" });
      const e = await createTurn(db, { parent: a.id, siblingOrder: "p" });
      await createTurn(db, { parent: c.id }); // F

      await service.deleteTurn(c.id, true);

      // B, D, E should maintain their relative order
      const children = await getTurnsByParent(db, a.id);
      expect(children.map((t) => t.id)).toEqual([b.id, d.id, e.id]);
      // They should keep their original fractional positions
      expect(children[0].siblingOrder).toBe("m");
      expect(children[1].siblingOrder).toBe("o");
      expect(children[2].siblingOrder).toBe("p");
    });
  });

  describe("promotion deletion", () => {
    it("promotes single child", async () => {
      // A -> B -> C becomes A -> C
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id });
      const c = await createTurn(db, { parent: b.id });

      await service.deleteTurn(b.id, false);

      const cTurn = await getTurn(db, c.id);
      expect(cTurn!.parentTurnId).toBe(a.id);
    });

    it("promotes single child to root", async () => {
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id });

      await service.deleteTurn(a.id, false);

      const bAfter = await getTurn(db, b.id);
      expect(bAfter!.parentTurnId).toBeNull();
    });

    it("promotes into empty parent", async () => {
      //    A
      //    |
      //    B     <- only child
      //   / \
      //  C   D
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id });
      const c = await createTurn(db, { parent: b.id, siblingOrder: RANKS[0] });
      const d = await createTurn(db, { parent: b.id, siblingOrder: RANKS[1] });

      await service.deleteTurn(b.id, false);

      // C and D should be the only children of A now
      const children = await getTurnsByParent(db, a.id);
      expect(children.length).toBe(2);
      // They should remain in order
      expect(children.map((t) => t.id)).toEqual([c.id, d.id]);
    });

    it("promotes multiple children maintaining order", async () => {
      //       A                A
      //      / \             / | \
      //     B   C     =>    D  E  C
      //    / \
      //   D   E
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id, siblingOrder: RANKS[0] });
      const c = await createTurn(db, { parent: a.id, siblingOrder: RANKS[1] });
      const d = await createTurn(db, { parent: b.id, siblingOrder: RANKS[0] });
      const e = await createTurn(db, { parent: b.id, siblingOrder: RANKS[1] });

      await service.deleteTurn(b.id, false);

      // All children should be promoted with correct order
      const children = await getTurnsByParent(db, a.id);
      expect(children.map((t) => t.id)).toEqual([d.id, e.id, c.id]);
    });

    it("promotes multiple children in between two siblings", async () => {
      //      A                     A
      //    / | \                / /|\ \
      //   B  C  D     =>       B E F G D
      //     /|\                   (C deleted)
      //    E F G               (E F G inserted between B and D)
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id, siblingOrder: RANKS[0] });
      const c = await createTurn(db, { parent: a.id, siblingOrder: RANKS[1] });
      const d = await createTurn(db, { parent: a.id, siblingOrder: RANKS[2] });
      const e = await createTurn(db, { parent: c.id, siblingOrder: RANKS[0] });
      const f = await createTurn(db, { parent: c.id, siblingOrder: RANKS[1] });
      const g = await createTurn(db, { parent: c.id, siblingOrder: RANKS[2] });

      await service.deleteTurn(c.id, false);

      // After: A's children should be [B, E, F, G, D] in order
      const children = await getTurnsByParent(db, a.id);
      expect(children.map((t) => t.id)).toEqual([b.id, e.id, f.id, g.id, d.id]);
      // All promoted children should have parentTurnId === a.id
      for (const child of [e, f, g]) {
        const turn = await getTurn(db, child.id);
        expect(turn!.parentTurnId).toBe(a.id);
      }
    });

    it("promotes children when deleting first sibling", async () => {
      //     A                A
      //   / | \            / | \
      //  B  C  D   =>     E  C  D
      //  |
      //  E
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id, siblingOrder: RANKS[0] });
      const c = await createTurn(db, { parent: a.id, siblingOrder: RANKS[1] });
      const d = await createTurn(db, { parent: a.id, siblingOrder: RANKS[2] });
      const e = await createTurn(db, { parent: b.id });

      await service.deleteTurn(b.id, false);

      const children = await getTurnsByParent(db, a.id);
      expect(children.map((t) => t.id)).toEqual([e.id, c.id, d.id]);
    });

    it("promotes children when deleting last sibling", async () => {
      //     A                A
      //    / \              / \
      //   B   C    =>      B   D
      //        \
      //         D
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id, siblingOrder: RANKS[0] });
      const c = await createTurn(db, { parent: a.id, siblingOrder: RANKS[1] });
      const d = await createTurn(db, { parent: c.id });

      await service.deleteTurn(c.id, false);

      // d should be promoted after b without colliding with anything
      const children = await getTurnsByParent(db, a.id);
      expect(children.map((t) => t.id)).toEqual([b.id, d.id]);
    });

    it("updates anchor when anchor is a promoted child", async () => {
      //     A
      //     |
      //     B    <- delete this
      //    / \
      //   C   D  <- anchor is here
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id });
      /* c */ await createTurn(db, { parent: b.id, siblingOrder: RANKS[0] });
      const d = await createTurn(db, { parent: b.id, siblingOrder: RANKS[1] });
      await setAnchor(db, TEST_SCENARIO_ID, d.id);

      await service.deleteTurn(b.id, false);

      // D is now child of A, but should remain the anchor
      const scenario = await db.query.scenarios.findFirst({
        where: { id: TEST_SCENARIO_ID },
      });
      expect(scenario!.anchorTurnId).toBe(d.id);

      const dTurn = await getTurn(db, d.id);
      expect(dTurn!.parentTurnId).toBe(a.id);
    });

    it("updates anchor when it's a descendant of promoted child", async () => {
      //     A
      //     |
      //     B    <- delete this
      //     |
      //     C
      //     |
      //     D    <- anchor is here
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id });
      const c = await createTurn(db, { parent: b.id });
      const d = await createTurn(db, { parent: c.id });
      await setAnchor(db, TEST_SCENARIO_ID, d.id);

      await service.deleteTurn(b.id, false);

      // C is now child of A, but D (the anchor) is still child of C
      // Anchor should remain at D
      const scenario = await db.query.scenarios.findFirst({
        where: { id: TEST_SCENARIO_ID },
      });
      expect(scenario!.anchorTurnId).toBe(d.id);
    });

    it("handles siblings with arbitrary existing ranks", async () => {
      //      A
      //    / | \
      //   B  C  D
      //      |
      //      E

      const ranks = ranksBetween("dd", "ll", 3);
      const a = await createTurn(db, { parent: null });
      const b = await createTurn(db, { parent: a.id, siblingOrder: ranks[0] });
      const c = await createTurn(db, { parent: a.id, siblingOrder: ranks[1] });
      const d = await createTurn(db, { parent: a.id, siblingOrder: ranks[2] });
      const e = await createTurn(db, { parent: c.id });

      await service.deleteTurn(c.id, false);

      const children = await getTurnsByParent(db, a.id);
      expect(children.map((t) => t.id)).toEqual([b.id, e.id, d.id]);
    });

    it("rejects promoting multiple children to root", async () => {
      const a = await createTurn(db, { parent: null });
      /* b */ await createTurn(db, { parent: a.id });
      /* c */ await createTurn(db, { parent: a.id, siblingOrder: "1" });

      await expect(service.deleteTurn(a.id, false)).rejects.toThrow("CannotPromoteMultipleToRoot");
    });
  });

  it("rolls back all changes when promotion fails", async () => {
    const a = await createTurn(db, { parent: null });
    const b = await createTurn(db, { parent: a.id, siblingOrder: RANKS[0] });
    const c = await createTurn(db, { parent: a.id, siblingOrder: RANKS[1] });

    // Snapshot state before
    const beforeTurns = await getTurnIds(db);

    // This should fail (can't promote multiple to root)
    await expect(service.deleteTurn(a.id, false)).rejects.toThrow();

    // Everything should be unchanged
    const afterTurns = await getTurnIds(db);
    expect(afterTurns).toEqual(beforeTurns);

    // Verify specific turns still exist with correct structure
    const aTurn = await getTurn(db, a.id);
    expect(aTurn).toBeDefined();
    const children = await getTurnsByParent(db, a.id);
    expect(children.map((t) => t.id)).toEqual([b.id, c.id]);
  });
});

async function getTurnsByParent(db: SqliteDatabase, parentId: string | null): Promise<Turn[]> {
  return db
    .select()
    .from(schema.turns)
    .where(parentId ? eq(schema.turns.parentTurnId, parentId) : isNull(schema.turns.parentTurnId))
    .orderBy(schema.turns.siblingOrder);
}

async function setAnchor(db: SqliteDatabase, scenarioId: string, turnId: string) {
  await db
    .update(schema.scenarios)
    .set({ anchorTurnId: turnId })
    .where(eq(schema.scenarios.id, scenarioId));
}

async function getTurn(db: SqliteDatabase, id: string) {
  return db.select().from(schema.turns).where(eq(schema.turns.id, id)).limit(1).get();
}

async function getTurnIds(db: SqliteDatabase): Promise<string[]> {
  const turns = await db.select().from(schema.turns);
  return turns.map((t) => t.id);
}
