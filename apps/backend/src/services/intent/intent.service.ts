import { type SqliteDatabase, schema } from "@storyforge/db";
import type { WorkflowRunner } from "@storyforge/gentasks";
import { assertNever, createId } from "@storyforge/utils";
import type { TimelineService } from "../timeline/timeline.service.js";
import { makeExecutors } from "./executors.js";
import { intentRunManager } from "./run-manager.js";
import type { CreateIntentArgs } from "./types.js";

export class IntentService {
  constructor(
    private db: SqliteDatabase,
    private timeline: TimelineService,
    private runner: WorkflowRunner<"turn_generation">
  ) {}

  async createAndStart(args: CreateIntentArgs) {
    if (!intentRunManager) throw new Error("Run manager not initialized");

    const intentId = createId();

    // 1) record pending intent with params
    const [intent] = await this.db
      .insert(schema.intents)
      .values({
        id: intentId,
        status: "pending",
        kind: args.kind,
        scenarioId: args.scenarioId,
        targetParticipantId: "targetParticipantId" in args ? args.targetParticipantId : null,
        inputText: "text" in args ? args.text : null,
      })
      .returning();

    // 2) choose appropriate intent executor
    const abortCtl = new AbortController();
    const executors = makeExecutors({
      db: this.db,
      timeline: this.timeline,
      runner: this.runner,
      now: () => Date.now(),
      intentId,
      scenarioId: args.scenarioId,
      signal: abortCtl.signal,
    });
    const exec = (() => {
      switch (args.kind) {
        case "manual_control":
          return executors.manualControl({
            actorId: args.targetParticipantId,
            text: args.text,
          });
        case "guided_control":
          return executors.guidedControl({
            actorId: args.targetParticipantId,
            constraint: args.text,
          });
        case "narrative_constraint":
          return executors.narrativeConstraint({ text: args.text });
        case "continue_story":
          return executors.continueStory();
        default:
          assertNever(args);
      }
    })();

    // 3) start the runner
    intentRunManager.start(intentId, args.scenarioId, args.kind, exec, abortCtl);

    return intent;
  }
}
