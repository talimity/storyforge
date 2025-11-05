import type { LorebookAssignment } from "@storyforge/lorebooks";
import type { InjectionTarget } from "@storyforge/prompt-rendering";
import { describe, expect, it } from "vitest";
import {
  buildDefaultChapterSeparatorLaneSpec,
  CHAPTER_SEPARATOR_LANE_ID,
} from "../../attachments/chapter-separators.js";
import {
  buildDefaultLoreLaneSpec,
  LORE_ATTACHMENT_REQUIRED_ANCHORS,
} from "../../attachments/lore.js";
import type { TurnGenContext } from "./context.js";
import { buildTurnGenRenderOptions } from "./render-options.js";

const baseContext: TurnGenContext = {
  turns: [],
  characters: [],
  chapterSummaries: [],
  chapters: [],
  actor: { id: "actor", name: "Actor", description: "", type: "character" },
  nextTurnNumber: 1,
  globals: {
    char: "Actor",
    user: "Player",
    scenario: "Test",
    currentChapterNumber: 1,
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
    const lanes = options.attachmentDefaults ?? [];
    expect(lanes).toHaveLength(2);
    const loreLane = lanes.find((lane) => lane.id === "lore");
    const chapterLane = lanes.find((lane) => lane.id === CHAPTER_SEPARATOR_LANE_ID);
    expect(loreLane).toMatchObject(buildDefaultLoreLaneSpec());
    expect(chapterLane).toMatchObject(buildDefaultChapterSeparatorLaneSpec());
    expect(options.injections ?? []).toHaveLength(0);
  });

  it("produces injections for before_char positions", () => {
    const ctx: TurnGenContext = {
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
      { kind: "at", key: LORE_ATTACHMENT_REQUIRED_ANCHORS.characters.start },
      { kind: "boundary", position: "top", delta: 0 },
    ]);
  });

  it("derives depth anchors for numeric positions", () => {
    const ctx: TurnGenContext = {
      ...baseContext,
      turns: [
        {
          turnId: "t1",
          turnNo: 1,
          chapterNumber: 1,
          authorName: "A",
          authorType: "character",
          content: "",
          layers: {},
          events: [],
        },
        {
          turnId: "t2",
          turnNo: 2,
          chapterNumber: 1,
          authorName: "A",
          authorType: "character",
          content: "",
          layers: {},
          events: [],
        },
        {
          turnId: "t3",
          turnNo: 3,
          chapterNumber: 1,
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
    const loreInjections = (options.injections ?? []).filter(
      (injection) => injection.lane === "lore"
    );
    expect(loreInjections).toHaveLength(1);
    const injection = loreInjections[0];
    expect(injection?.groupId).toBe("turn_2");
    const target = injection?.target;
    expect(Array.isArray(target)).toBe(true);
    const targets = target as InjectionTarget[];
    expect(targets[0]).toEqual({ kind: "at", key: "turn_2" });
    expect(targets.some((t) => t.kind === "boundary" && t.position === "bottom")).toBe(true);
  });

  it("reserves tokens equal to combined lorebook budgets", () => {
    const ctx: TurnGenContext = {
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
    expect(options.attachmentDefaults?.[0]?.reserveTokens).toBe(70);
  });

  it("emits chapter separator injections between chapters", () => {
    const ctx: TurnGenContext = {
      ...baseContext,
      turns: [
        {
          turnId: "ta",
          turnNo: 10,
          chapterNumber: 4,
          authorName: "A",
          authorType: "character",
          content: "",
          layers: {},
          events: [],
        },
        {
          turnId: "tb",
          turnNo: 11,
          chapterNumber: 4,
          authorName: "A",
          authorType: "character",
          content: "",
          layers: {},
          events: [],
        },
        {
          turnId: "tc",
          turnNo: 12,
          chapterNumber: 5,
          authorName: "B",
          authorType: "character",
          content: "",
          layers: {},
          events: [],
        },
      ],
      chapterSummaries: [
        { chapterNumber: 5, title: "Awakening", updatedAt: new Date() },
      ] as TurnGenContext["chapterSummaries"],
    };

    const options = buildTurnGenRenderOptions({
      ...ctx,
      chapters: [
        { chapterNumber: 4, title: "Shadows", breakEventId: "ev4", breakTurnId: "ta" },
        { chapterNumber: 5, title: "Awakening", breakEventId: "ev5", breakTurnId: "tc" },
      ],
    });
    const separators = (options.injections ?? []).filter(
      (injection) => injection.lane === CHAPTER_SEPARATOR_LANE_ID
    );
    expect(separators).toHaveLength(2);
    const chapterFour = separators.find((injection) => injection.payload?.chapterNumber === 4);
    expect(chapterFour?.target).toEqual([
      { kind: "at", key: "turn_10_before" },
      { kind: "at", key: "turn_9" },
    ]);
    expect(chapterFour?.payload).toMatchObject({ chapterNumber: 4, title: "Shadows" });

    const chapterFive = separators.find((injection) => injection.payload?.chapterNumber === 5);
    expect(chapterFive?.target).toEqual([
      { kind: "at", key: "turn_12_before" },
      { kind: "at", key: "turn_11" },
    ]);
    expect(chapterFive?.payload).toMatchObject({ chapterNumber: 5, title: "Awakening" });
  });
});
