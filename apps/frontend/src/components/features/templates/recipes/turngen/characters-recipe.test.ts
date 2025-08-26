import { describe, expect, it } from "vitest";
import { charactersRecipe } from "./characters-recipe";

describe("charactersRecipe", () => {
  it("should generate valid SlotSpec with default parameters", () => {
    const params = {
      maxChars: 6,
      order: "asc",
      format: "prose",
      characterTemplate: "{{item.name}} — {{item.description}}",
      budget: 600,
    };

    const slotSpec = charactersRecipe.toSlotSpec(params);

    expect(slotSpec.priority).toBe(1);
    expect(slotSpec.budget?.maxTokens).toBe(600);
    expect(slotSpec.plan).toHaveLength(1);
    expect(slotSpec.plan[0]).toEqual({
      kind: "forEach",
      source: {
        source: "characters",
        args: { order: "asc", limit: 6 },
      },
      map: [
        {
          kind: "message",
          role: "user",
          content: "{{item.name}} — {{item.description}}",
        },
      ],
      budget: { maxTokens: 600 },
      stopWhenOutOfBudget: true,
    });
  });

  it("should format with bullets when requested", () => {
    const params = {
      maxChars: 4,
      order: "desc",
      format: "bullets",
      characterTemplate: "{{item.name}}: {{item.description}}",
      budget: 400,
    };

    const slotSpec = charactersRecipe.toSlotSpec(params);

    expect(slotSpec.plan[0]).toMatchObject({
      map: [
        {
          kind: "message",
          role: "user",
          content: "• {{item.name}}: {{item.description}}",
        },
      ],
    });
  });

  describe("parameter coercion", () => {
    it("should coerce invalid format to default", () => {
      const params = {
        format: "invalid_format",
        maxChars: 4,
        order: "asc",
        characterTemplate: "{{item.name}}",
        budget: 400,
      };

      const slotSpec = charactersRecipe.toSlotSpec(params);

      // Should use prose format (no bullet prefix)
      expect(slotSpec.plan[0]).toMatchObject({
        map: [
          {
            kind: "message",
            role: "user",
            content: "{{item.name}}",
          },
        ],
      });
    });

    it("should respect valid bullets format", () => {
      const params = {
        format: "bullets",
        maxChars: 4,
        order: "asc",
        characterTemplate: "{{item.name}}",
        budget: 400,
      };

      const slotSpec = charactersRecipe.toSlotSpec(params);

      // Should add bullet prefix
      expect(slotSpec.plan[0]).toMatchObject({
        map: [
          {
            kind: "message",
            role: "user",
            content: "• {{item.name}}",
          },
        ],
      });
    });
  });
});
