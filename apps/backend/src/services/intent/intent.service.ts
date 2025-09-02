import { type SqliteDatabase, schema } from "@storyforge/db";
import type { WorkflowRunner } from "@storyforge/gentasks";
import { assertNever, createId } from "@storyforge/utils";
import type { TimelineService } from "../timeline/timeline.service.js";
import { intentRunManager } from "./run-manager.js";
import { makeSagas } from "./sagas.js";

export type CreateIntentArgs =
  | {
      kind: "manual_control";
      scenarioId: string;
      targetParticipantId: string;
      text: string;
    }
  | {
      kind: "guided_control";
      scenarioId: string;
      targetParticipantId: string;
      text: string;
    }
  | { kind: "narrative_constraint"; scenarioId: string; text: string }
  | { kind: "continue_story"; scenarioId: string };

export class IntentService {
  constructor(
    private db: SqliteDatabase,
    private timeline: TimelineService,
    private runner: WorkflowRunner<"turn_generation">
  ) {}

  async createAndStart(args: CreateIntentArgs) {
    if (!intentRunManager) throw new Error("Run manager not initialized");

    const intentId = createId();

    // 1) create DB row as pending + stash parameters
    const [intent] = await this.db
      .insert(schema.intents)
      .values({
        id: intentId,
        scenarioId: args.scenarioId,
        kind: args.kind,
        status: "pending",
        parameters: argsToParams(args),
      })
      .returning();

    // 2) choose intent saga
    const sagas = makeSagas({
      db: this.db,
      timeline: this.timeline,
      runner: this.runner,
      now: () => Date.now(),
      intentId,
      scenarioId: args.scenarioId,
    });
    const saga = (() => {
      const kind = args.kind;
      switch (kind) {
        case "manual_control":
          return sagas.manualControl({
            actorId: args.targetParticipantId,
            text: args.text,
          });
        case "guided_control":
          return sagas.guidedControl({
            actorId: args.targetParticipantId,
            constraint: args.text,
          });
        case "narrative_constraint":
          return sagas.narrativeConstraint({ text: args.text });
        case "continue_story":
          return sagas.continueStory();
        default:
          assertNever(kind);
      }
    })();

    // 3) start the runner
    intentRunManager.start(intentId, args.scenarioId, args.kind, saga);

    return intent;
  }
}

function argsToParams(args: CreateIntentArgs) {
  const base: Record<string, unknown> = { kind: args.kind };
  if ("actorParticipantId" in args)
    base.actorParticipantId = args.actorParticipantId;
  if ("text" in args) base.text = args.text;
  return base;
}
