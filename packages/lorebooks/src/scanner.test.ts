import { describe, expect, it } from "vitest";
import { type LorebookAssignment, scanLorebooks, scanLorebooksDebug } from "./scanner.js";

describe("scanLorebooks", () => {
  const makeAssignment = (
    data: LorebookAssignment["data"],
    overrides?: Partial<LorebookAssignment>
  ): LorebookAssignment => ({
    lorebookId: overrides?.lorebookId ?? "book-1",
    orderIndex: overrides?.orderIndex ?? 0,
    enabled: overrides?.enabled ?? true,
    data,
  });

  const makeTurn = (content: string) => ({ content });

  it("activates constant entries regardless of turn content", () => {
    const assignment = makeAssignment({
      entries: [
        {
          id: "entry-1",
          enabled: true,
          constant: true,
          comment: "always included",
          keys: ["ignored"],
          selective: false,
          content: "Constant lore",
          extensions: {},
          insertion_order: 0,
        },
      ],
      extensions: {},
    });

    const result = scanLorebooks({ turns: [makeTurn(""), makeTurn("")], lorebooks: [assignment] });

    expect(result.before_char).toHaveLength(1);
    expect(result.before_char[0].content).toBe("Constant lore");
    expect(result.after_char).toHaveLength(0);
  });

  it("respects insertion order and scenario order when merging", () => {
    const assignmentA = makeAssignment(
      {
        entries: [
          {
            id: "a-2",
            enabled: true,
            keys: ["wyrm"],
            content: "Second",
            extensions: {},
            insertion_order: 2,
          },
          {
            id: "a-1",
            enabled: true,
            keys: ["dragon"],
            content: "First",
            extensions: {},
            insertion_order: 1,
          },
        ],
        extensions: {},
      },
      { lorebookId: "book-a", orderIndex: 1 }
    );

    const assignmentB = makeAssignment(
      {
        entries: [
          {
            id: "b-1",
            enabled: true,
            keys: ["knight"],
            content: "Prelude",
            extensions: {},
            insertion_order: 0,
          },
        ],
        extensions: {},
      },
      { lorebookId: "book-b", orderIndex: 0 }
    );

    const turns = [makeTurn("A bold knight met a dragon."), makeTurn("The wyrm retreated.")];

    const result = scanLorebooks({ turns, lorebooks: [assignmentA, assignmentB] });

    expect(result.before_char.map((entry) => entry.content)).toEqual([
      "Prelude",
      "First",
      "Second",
    ]);
  });

  it("enforces per-lorebook budgets using priority", () => {
    const assignment = makeAssignment({
      entries: [
        {
          id: "low",
          enabled: true,
          keys: ["sigil"],
          content: "Longer lore entry",
          extensions: {},
          insertion_order: 0,
          priority: 0,
        },
        {
          id: "high",
          enabled: true,
          keys: ["sigil"],
          content: "Lore",
          extensions: {},
          insertion_order: 1,
          priority: 10,
        },
      ],
      token_budget: 4,
      extensions: {},
    });

    const result = scanLorebooks({
      turns: [makeTurn("The sigil glowed.")],
      lorebooks: [assignment],
    });

    expect(result.before_char).toHaveLength(1);
    expect(result.before_char[0].entryId).toBe("high");
  });

  it("requires secondary keys when selective is true", () => {
    const assignment = makeAssignment({
      entries: [
        {
          id: "selective",
          enabled: true,
          keys: ["artifact"],
          selective: true,
          secondary_keys: ["sealed"],
          content: "The artifact was sealed away.",
          extensions: {},
          insertion_order: 0,
        },
      ],
      extensions: {},
    });

    const withoutSecondary = scanLorebooks({
      turns: [makeTurn("The artifact pulsed with light.")],
      lorebooks: [assignment],
    });
    expect(withoutSecondary.before_char).toHaveLength(0);

    const withSecondary = scanLorebooks({
      turns: [
        makeTurn("The artifact pulsed with light."),
        makeTurn("Ancient wards kept it sealed."),
      ],
      lorebooks: [assignment],
    });
    expect(withSecondary.before_char).toHaveLength(1);
  });

  it("activates entries through recursive scanning", () => {
    const assignment = makeAssignment({
      recursive_scanning: true,
      entries: [
        {
          id: "seed",
          enabled: true,
          keys: ["artifact"],
          content: "It whispers about the hidden sigil.",
          extensions: {},
          insertion_order: 0,
        },
        {
          id: "triggered",
          enabled: true,
          keys: ["hidden sigil"],
          content: "The sigil binds the realm.",
          extensions: {},
          insertion_order: 1,
        },
      ],
      extensions: {},
    });

    const result = scanLorebooks({
      turns: [makeTurn("The artifact hummed."), makeTurn("Silence followed.")],
      lorebooks: [assignment],
      options: { maxRecursionRounds: 3 },
    });

    expect(result.before_char.map((entry) => entry.entryId)).toEqual(["seed", "triggered"]);
  });

  it("captures regex compilation errors in debug mode", () => {
    const assignment = makeAssignment({
      entries: [
        {
          id: "regex",
          enabled: true,
          keys: ["["],
          content: "Broken regex",
          extensions: {},
          insertion_order: 0,
          use_regex: true,
        },
      ],
      extensions: {},
    });

    const debug = scanLorebooksDebug({ turns: [makeTurn("text")], lorebooks: [assignment] });
    expect(debug.trace[0].entries[0].errors.length).toBeGreaterThan(0);
  });
});
