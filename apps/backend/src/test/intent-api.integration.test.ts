import { setTimeout as delay } from "node:timers/promises";
import { type SqliteDatabase, schema } from "@storyforge/db";
import { beforeAll, describe, expect, it } from "vitest";
import { initRunManager, intentRunManager } from "../services/intent/run-manager.js";
import { ScenarioService } from "../services/scenario/scenario.service.js";
import { createFreshTestCaller, createTestDatabase } from "../test/setup.js";

async function seedMockInference(db: SqliteDatabase) {
  // Provider (mock)
  const [provider] = await db
    .insert(schema.providerConfigs)
    .values({
      kind: "mock" as any,
      name: "Mock Provider",
      auth: { apiKey: "test" },
      baseUrl: null,
    })
    .returning();

  // Model profile
  const [profile] = await db
    .insert(schema.modelProfiles)
    .values({
      providerId: provider.id,
      displayName: "Mock Fast",
      modelId: "mock-fast",
    })
    .returning();

  // Minimal turn_generation template (no sources)
  const [tmpl] = await db
    .insert(schema.promptTemplates)
    .values({
      name: "Minimal TurnGen",
      description: "Minimal test template",
      kind: "turn_generation",
      version: 1,
      layout: [
        {
          kind: "message",
          name: "systemMessage",
          role: "system",
          content: "You are a helpful assistant.",
        },
        { kind: "message", role: "user", content: "Write 1-2 sentences." },
      ],
      slots: {},
    })
    .returning();

  // Workflow (single gen step capturing assistant text as 'presentation')
  const steps = [
    {
      id: "gen",
      modelProfileId: profile.id,
      promptTemplateId: tmpl.id,
      stop: [],
      outputs: [{ key: "presentation", capture: "assistantText" }],
    },
  ];
  const [wf] = await db
    .insert(schema.workflows)
    .values({
      task: "turn_generation",
      name: "Default TurnGen",
      description: "Test workflow",
      version: 1,
      isBuiltIn: true,
      steps,
    })
    .returning();

  // Default scope binding
  await db.insert(schema.workflowScopes).values({
    workflowId: wf.id,
    workflowTask: "turn_generation",
    scopeKind: "default",
  });
}

async function seedScenario(db: SqliteDatabase) {
  // Two characters
  const [alice, bob] = await db
    .insert(schema.characters)
    .values([
      { name: "Alice", description: "Hero" },
      { name: "Bob", description: "Sidekick" },
    ])
    .returning();

  const svc = new ScenarioService(db);
  const sc = await svc.createScenario({
    name: "Intent Test Scenario",
    description: "",
    status: "active",
    settings: {},
    metadata: {},
    participants: [
      { characterId: alice.id, isUserProxy: true },
      { characterId: bob.id, isUserProxy: false },
    ],
    lorebooks: [],
  });
  return sc.id;
}

describe("intents.intentProgress subscription (runner events)", () => {
  let db: SqliteDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
    // Initialize run manager singleton for this DB
    initRunManager({ db, now: () => Date.now() });
    await seedMockInference(db);
  });

  it("streams events until completion and updates intent status", async () => {
    const scenarioId = await seedScenario(db);
    const { caller } = await createFreshTestCaller(db);

    // Start an intent (continue story)
    const { intentId } = await caller.intents.createIntent({
      scenarioId,
      parameters: { kind: "continue_story" },
    });

    // Ensure run exists
    expect(intentRunManager?.get(intentId)).toBeTruthy();

    const events: string[] = [];
    for await (const ev of intentRunManager!.get(intentId)!.events()) {
      events.push(ev.type);
      if (ev.type === "intent_finished") break;
    }

    // Event shape assertions
    expect(events[0]).toBe("intent_started");
    expect(events).toContain("actor_selected");
    expect(events).toContain("gen_token");
    expect(events).toContain("effect_committed");
    expect(events.at(-1)).toBe("intent_finished");

    // Intent status should be finished
    const finished = await db.query.intents.findFirst({
      where: { id: intentId },
    });
    expect(finished?.status).toBe("finished");

    // A turn should have been created
    const effect = await db.query.intentEffects.findFirst({
      where: { intentId },
    });
    expect(effect?.turnId).toBeTruthy();
    const turn = await db.query.turns.findFirst({
      where: { id: effect!.turnId },
    });
    expect(turn).toBeTruthy();
  });

  it("replays buffered events produced before a subscriber starts reading", async () => {
    const scenarioId = await seedScenario(db);
    const { caller } = await createFreshTestCaller(db);

    const { intentId } = await caller.intents.createIntent({
      scenarioId,
      parameters: { kind: "continue_story" },
    });

    // Wait so some tokens are produced before we attach
    await delay(50);

    const attachAt = Date.now();
    const received: { type: string; ts: number }[] = [];
    for await (const ev of intentRunManager!.get(intentId)!.events()) {
      received.push({ type: ev.type, ts: ev.ts });
      if (ev.type === "intent_finished") break;
    }

    // We should receive events emitted before we attached (buffer backfill)
    expect(received.length).toBeGreaterThan(1);
    expect(received[0].type).toBe("intent_started");
    expect(received[0].ts).toBeLessThanOrEqual(attachAt);
    // And we should finish (success or failure still demonstrates buffering)
    expect(["intent_finished", "intent_failed"]).toContain(received.at(-1)!.type);
  });

  it("interrupts a running intent and sets status to cancelled", async () => {
    const scenarioId = await seedScenario(db);

    // Create a baseline anchor turn so intentResult always has an anchor ID
    const narrator = await db.query.scenarioParticipants.findFirst({
      where: { scenarioId, type: "narrator" },
      columns: { id: true },
    });
    const { TimelineService } = await import("../services/timeline/timeline.service.js");
    const tl = new TimelineService(db);
    await tl.advanceTurn({
      scenarioId,
      authorParticipantId: narrator!.id,
      layers: [{ key: "presentation", content: "Baseline" }],
    });

    // Create a slow workflow scoped to this scenario so we can cancel mid-flight
    const provider = await db.query.providerConfigs.findFirst({ where: { kind: "mock" as any } });
    const [slowProfile] = await db
      .insert(schema.modelProfiles)
      .values({ providerId: provider!.id, displayName: "Mock Slow", modelId: "mock-slow" })
      .returning();
    const [tmpl] = await db.query.promptTemplates.findMany({ limit: 1 });
    const slowSteps = [
      {
        id: "gen",
        modelProfileId: slowProfile.id,
        promptTemplateId: tmpl!.id,
        stop: [],
        outputs: [{ key: "presentation", capture: "assistantText" }],
      },
    ];
    const [slowWf] = await db
      .insert(schema.workflows)
      .values({ task: "turn_generation", name: "Slow TurnGen", isBuiltIn: false, steps: slowSteps })
      .returning();
    await db.insert(schema.workflowScopes).values({
      workflowId: slowWf.id,
      workflowTask: "turn_generation",
      scopeKind: "scenario",
      scenarioId,
    });

    const { caller } = await createFreshTestCaller(db);
    const { intentId } = await caller.intents.createIntent({
      scenarioId,
      parameters: { kind: "continue_story" },
    });

    // Cancel soon after start to ensure it's still running
    const interruptResult = await caller.intents.interruptIntent({
      intentId,
    });
    expect(interruptResult.success).toBe(true);

    // Consume terminal event
    const evs: string[] = [];
    for await (const ev of intentRunManager!.get(intentId)!.events()) {
      evs.push(ev.type);
      if (ev.type === "intent_finished") break;
    }
    expect(evs.at(-1)).toBe("intent_failed"); // cancel surfaces as failed event

    const row = await db.query.intents.findFirst({ where: { id: intentId } });
    expect(row?.status).toBe("cancelled");

    // Check result procedure
    const result = await caller.intents.intentResult({ intentId });
    expect(result.id).toBe(intentId);
    expect(result.status).toBe("cancelled");
  });

  it("returns intent result with effects and sequence when finished", async () => {
    const scenarioId = await seedScenario(db);
    const { caller } = await createFreshTestCaller(db);

    const chara = await db.query.scenarioParticipants.findFirst({
      where: { scenarioId, type: "character" },
      columns: { id: true },
    });

    const { intentId } = await caller.intents.createIntent({
      scenarioId,
      parameters: { kind: "manual_control", text: "hi", targetParticipantId: chara?.id ?? "" },
    });

    // Drain to completion
    for await (const ev of intentRunManager!.get(intentId)!.events()) {
      if (ev.type === "intent_finished") break;
    }

    const res = await caller.intents.intentResult({ intentId });
    expect(res.id).toBe(intentId);
    expect(res.status).toBe("finished");
    expect(res.effects.length).toBe(2);
    expect(res.effects[0].sequence).toBe(0);
    expect(res.effects[1].sequence).toBe(1);
  });

  it("annotates timeline turns with intent provenance", async () => {
    const scenarioId = await seedScenario(db);
    const { caller } = await createFreshTestCaller(db);

    const participant = await db.query.scenarioParticipants.findFirst({
      where: { scenarioId, type: "character" },
      columns: { id: true },
    });
    expect(participant?.id).toBeTruthy();
    if (!participant) {
      throw new Error("Expected scenario participant for manual control test");
    }

    const manualText = "Player writes first turn";
    const { intentId } = await caller.intents.createIntent({
      scenarioId,
      parameters: {
        kind: "manual_control",
        text: manualText,
        targetParticipantId: participant.id,
      },
    });

    for await (const ev of intentRunManager!.get(intentId)!.events()) {
      if (ev.type === "intent_finished") break;
    }

    const timeline = await caller.timeline.window({ scenarioId, windowSize: 20 });
    const turnsFromIntent = timeline.timeline.filter((t) => t.provenance?.intentId === intentId);

    expect(turnsFromIntent).toHaveLength(2);
    for (const turn of turnsFromIntent) {
      const prov = turn.provenance;
      expect(prov).not.toBeNull();
      if (!prov) {
        throw new Error("Expected intent provenance on timeline turn");
      }
      expect(prov.intentKind).toBe("manual_control");
      expect(prov.intentStatus).toBe("finished");
      expect(prov.effectCount).toBe(2);
      expect(prov.inputText).toBe(manualText);
      expect(prov.targetParticipantId).toBe(participant.id);
    }

    const [playerTurn, followUpTurn] = turnsFromIntent;
    const playerProv = playerTurn.provenance;
    const followUpProv = followUpTurn.provenance;
    expect(playerProv).not.toBeNull();
    expect(followUpProv).not.toBeNull();
    if (!playerProv || !followUpProv) {
      throw new Error("Expected intent provenance for manual control turns");
    }
    expect(playerProv.effectSequence).toBeLessThan(followUpProv.effectSequence);
  });
});
