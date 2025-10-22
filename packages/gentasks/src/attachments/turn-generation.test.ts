import type { LorebookAssignment } from "@storyforge/lorebooks";
import type { InjectionTarget } from "@storyforge/prompt-rendering";
import { describe, expect, it } from "vitest";
import type { TurnGenCtx } from "../tasks/turn-generation.js";
import {
  buildDefaultLoreLaneSpec,
  buildTurnGenRenderOptions,
  TURN_GEN_REQUIRED_ANCHORS,
} from "./turn-generation.js";

const baseContext: TurnGenCtx = {
  turns: [],
  characters: [],
  actor: { id: "actor", name: "Actor", description: "", type: "character" },
  nextTurnNumber: 1,
  globals: {
    char: "Actor",
    user: "Player",
    scenario: "Test",
    isNarratorTurn: false,
  },
  lorebooks: [],
};

function makeAssignment(
  data: LorebookAssignment["data"],
  overrides?: Partial<LorebookAssignment>
): LorebookAssignment {
  return {
    lorebookId: overrides?.lorebookId ?? "book-1",
    kind: overrides?.kind ?? "manual",
    enabled: overrides?.enabled ?? true,
    defaultEnabled: overrides?.defaultEnabled ?? true,
    characterId: overrides?.characterId ?? null,
    characterLorebookId: overrides?.characterLorebookId ?? null,
    data,
  };
}

describe("buildTurnGenRenderOptions", () => {
  it("returns default lore lane even when no assignments are enabled", () => {
    const options = buildTurnGenRenderOptions(baseContext);
    expect(options.attachments).toHaveLength(1);
    const defaults = buildDefaultLoreLaneSpec();
    const lane = options.attachments?.[0];
    expect(lane?.id).toBe("lore");
    expect(lane?.reserveTokens).toBeUndefined();
    expect(lane).toMatchObject(defaults);
    expect(options.injections).toHaveLength(0);
  });

  it("produces injections for before_char positions", () => {
    const ctx: TurnGenCtx = {
      ...baseContext,
      lorebooks: [
        makeAssignment({
          name: "Test",
          entries: [
            {
              id: "entry-1",
              enabled: true,
              constant: true,
              insertion_order: 0,
              comment: "",
              content: "Lore snippet",
              keys: ["irrelevant"],
              extensions: {},
              position: "before_char",
            },
          ],
          extensions: {},
        }),
      ],
    };

    const options = buildTurnGenRenderOptions(ctx);
    expect(options.injections).toHaveLength(1);
    const injection = options.injections?.[0];
    expect(injection?.groupId).toBe("before_char");
    const target = injection?.target;
    expect(target).toEqual([
      { kind: "at", key: TURN_GEN_REQUIRED_ANCHORS.characters.start },
      { kind: "boundary", position: "top", delta: 0 },
    ]);
  });

  it("derives depth anchors for numeric positions", () => {
    const ctx: TurnGenCtx = {
      ...baseContext,
      turns: [
        {
          turnId: "t1",
          turnNo: 1,
          authorName: "A",
          authorType: "character",
          content: "",
          layers: {},
          events: [],
        },
        {
          turnId: "t2",
          turnNo: 2,
          authorName: "A",
          authorType: "character",
          content: "",
          layers: {},
          events: [],
        },
        {
          turnId: "t3",
          turnNo: 3,
          authorName: "A",
          authorType: "character",
          content: "",
          layers: {},
          events: [],
        },
      ],
      lorebooks: [
        makeAssignment({
          name: "Depth",
          entries: [
            {
              id: "depth-entry",
              enabled: true,
              constant: true,
              insertion_order: 0,
              comment: "",
              content: "Depth lore",
              keys: ["depth"],
              extensions: {},
              position: -1,
            },
          ],
          extensions: {},
        }),
      ],
    };

    const options = buildTurnGenRenderOptions(ctx);
    expect(options.injections).toHaveLength(1);
    const injection = options.injections?.[0];
    expect(injection?.groupId).toBe("turn_2");
    const target = injection?.target;
    expect(Array.isArray(target)).toBe(true);
    const targets = target as InjectionTarget[];
    expect(targets[0]).toEqual({ kind: "at", key: "turn_2" });
    expect(targets.some((t) => t.kind === "boundary" && t.position === "bottom")).toBe(true);
  });

  it("reserves tokens equal to combined lorebook budgets", () => {
    const ctx: TurnGenCtx = {
      ...baseContext,
      lorebooks: [
        makeAssignment(
          {
            name: "Budget",
            entries: [
              {
                id: "constant",
                enabled: true,
                constant: true,
                insertion_order: 0,
                comment: "",
                content: "Lore",
                keys: ["alpha"],
                extensions: {},
              },
            ],
            token_budget: 50,
            extensions: {},
          },
          { lorebookId: "book-a" }
        ),
        makeAssignment(
          {
            name: "Budget B",
            entries: [
              {
                id: "constant-b",
                enabled: true,
                constant: true,
                insertion_order: 0,
                comment: "",
                content: "Lore",
                keys: ["beta"],
                extensions: {},
              },
            ],
            token_budget: 20,
            extensions: {},
          },
          { lorebookId: "book-b" }
        ),
      ],
    };

    const options = buildTurnGenRenderOptions(ctx);
    expect(options.attachments?.[0]?.reserveTokens).toBe(70);
  });
});
