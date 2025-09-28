import { type SqliteDatabase, schema } from "@storyforge/db";
import { chapterBreakSpec } from "@storyforge/timeline-events";
import { createId } from "@storyforge/utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ScenarioService } from "../services/scenario/scenario.service.js";
import { TimelineService } from "../services/timeline/timeline.service.js";
import { TimelineStateService } from "../services/timeline-events/timeline-state.service.js";
import { cleanupTestDatabase, createFreshTestCaller, createTestDatabase } from "./setup.js";

type TestCaller = Awaited<ReturnType<typeof createFreshTestCaller>>["caller"];

describe("timeline events integration", () => {
  let db: SqliteDatabase;
  let caller: TestCaller;
  let scenarioId: string;
  let rootTurnId: string;
  let bobParticipantId: string;
  let initialChapterEventId: string;
  let chapterBreakEventId: string;
  let presenceEventId: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    const fresh = await createFreshTestCaller(db);
    caller = fresh.caller;

    const [alice, bob] = await db
      .insert(schema.characters)
      .values([
        { name: "Alice", description: "Protagonist" },
        { name: "Bob", description: "Companion" },
      ])
      .returning({ id: schema.characters.id })
      .all();
    if (!alice || !bob) {
      throw new Error("Failed to seed characters for timeline events test");
    }

    const scenarioService = new ScenarioService(db);
    const scenario = await scenarioService.createScenario({
      name: "Timeline Event Scenario",
      description: "",
      status: "active",
      characterIds: [alice.id, bob.id],
      userProxyCharacterId: alice.id,
    });
    scenarioId = scenario.id;

    const narratorParticipant = await db.query.scenarioParticipants.findFirst({
      where: { scenarioId, type: "narrator" },
      columns: { id: true },
    });
    bobParticipantId = (await db.query.scenarioParticipants.findFirst({
      where: { scenarioId, characterId: bob.id },
      columns: { id: true },
    }))!.id;

    const timelineService = new TimelineService(db);
    rootTurnId = (
      await timelineService.advanceTurn({
        scenarioId,
        authorParticipantId: narratorParticipant!.id,
        layers: [{ key: "presentation", content: "The story begins." }],
      })
    ).id;

    // Seed an initial chapter event (null turn) to name the opening chapter.
    initialChapterEventId = createId();
    const initialPayload = chapterBreakSpec.schema.parse({ nextChapterTitle: "Prologue" });
    await db.insert(schema.timelineEvents).values({
      id: initialChapterEventId,
      scenarioId,
      turnId: null,
      orderKey: "m",
      kind: "chapter_break",
      payloadVersion: chapterBreakSpec.latest,
      payload: initialPayload,
    });

    const chapterInsert = await caller.timelineEvents.insertChapterBreakEvent({
      scenarioId,
      turnId: rootTurnId,
      nextChapterTitle: "Rising Action",
    });
    chapterBreakEventId = chapterInsert.eventId;

    const presenceInsert = await caller.timelineEvents.insertParticipantPresenceEvent({
      scenarioId,
      turnId: rootTurnId,
      participantId: bobParticipantId,
      active: false,
      status: "Captured",
    });
    presenceEventId = presenceInsert.eventId;
  });

  afterAll(() => {
    cleanupTestDatabase(db);
  });

  it("derives timeline state including initial events", async () => {
    const { state } = await caller.timeline.state({ scenarioId, atTurnId: rootTurnId });

    expect(state.chapters.chapters).toEqual([
      { number: 1, title: "Prologue", turnId: null },
      { number: 2, title: "Rising Action", turnId: rootTurnId },
    ]);

    expect(state.presence.participantPresence).toEqual({
      [bobParticipantId]: { active: false, status: "Captured" },
    });
  });

  it("embeds ordered events on timeline windows", async () => {
    const { timeline } = await caller.timeline.window({
      scenarioId,
      windowSize: 10,
    });

    expect(timeline).toHaveLength(1);
    const [turn] = timeline;
    expect(turn.id).toBe(rootTurnId);
    expect(turn.events.map((ev) => ev.kind)).toEqual(["chapter_break", "presence_change"]);
  });

  it("replays initial events ahead of turn events when deriving state", async () => {
    const stateService = new TimelineStateService(db);
    const derivation = await stateService.deriveState(scenarioId, rootTurnId);

    expect(derivation.events.map((ev) => ev.id)).toEqual([
      initialChapterEventId,
      chapterBreakEventId,
      presenceEventId,
    ]);

    expect(derivation.hints.get(initialChapterEventId)?.chapters).toEqual({ chapterNumber: 1 });
    expect(derivation.hints.get(chapterBreakEventId)?.chapters).toEqual({ chapterNumber: 2 });
  });
});
