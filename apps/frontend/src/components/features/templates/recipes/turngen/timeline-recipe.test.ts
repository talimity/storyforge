import { describe, expect, it } from "vitest";
import { timelineRecipe } from "./timeline-recipe";

describe("timelineRecipe", () => {
  it("should generate valid SlotSpec with default parameters", () => {
    const params = {
      maxTurns: 8,
      order: "desc",
      turnTemplate: "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}",
      budget: 900,
    };

    const slotSpec = timelineRecipe.toSlotSpec(params);

    expect(slotSpec.priority).toBe(0);
    expect(slotSpec.budget?.maxTokens).toBe(900);
    expect(slotSpec.plan).toHaveLength(1);
    expect(slotSpec.plan[0]).toEqual({
      kind: "forEach",
      source: {
        source: "turns",
        args: { order: "desc", limit: 8 },
      },
      map: [
        {
          kind: "message",
          role: "user",
          content: "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}",
        },
      ],
      budget: { maxTokens: 900 },
      stopWhenOutOfBudget: true,
    });
  });

  it("should handle custom parameters", () => {
    const params = {
      maxTurns: 3,
      order: "asc",
      turnTemplate: "{{item.authorName}} said: {{item.content}}",
      budget: 500,
    };

    const slotSpec = timelineRecipe.toSlotSpec(params);

    expect(slotSpec.budget?.maxTokens).toBe(500);
    expect(slotSpec.plan[0]).toMatchObject({
      source: {
        source: "turns",
        args: { order: "asc", limit: 3 },
      },
      map: [
        {
          kind: "message",
          role: "user",
          content: "{{item.authorName}} said: {{item.content}}",
        },
      ],
    });
  });

  describe("parameter coercion", () => {
    it("should coerce invalid order values to default", () => {
      const params = {
        order: "invalid_order",
        maxTurns: 5,
        turnTemplate: "{{item.content}}",
        budget: 500,
      };

      const slotSpec = timelineRecipe.toSlotSpec(params);

      // Should default to "desc" for invalid order
      expect(slotSpec.plan[0]).toMatchObject({
        source: {
          source: "turns",
          args: { order: "desc", limit: 5 },
        },
      });
    });

    it("should clamp numbers within valid ranges", () => {
      const params = {
        maxTurns: 50, // Above max of 20
        budget: 50, // Below min of 100
        order: "asc",
        turnTemplate: "{{item.content}}",
      };

      const slotSpec = timelineRecipe.toSlotSpec(params);

      // Should clamp maxTurns to 20
      expect(slotSpec.plan[0]).toMatchObject({
        source: {
          source: "turns",
          args: { order: "asc", limit: 20 },
        },
      });

      // Should clamp budget to 100
      expect(slotSpec.budget?.maxTokens).toBe(100);
    });

    it("should coerce non-string template to default", () => {
      const params = {
        turnTemplate: 123, // Invalid type
        maxTurns: 5,
        order: "desc",
        budget: 500,
      };

      const slotSpec = timelineRecipe.toSlotSpec(params);

      expect(slotSpec.plan[0]).toMatchObject({
        map: [
          {
            kind: "message",
            role: "user",
            content: "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}",
          },
        ],
      });
    });
  });
});
