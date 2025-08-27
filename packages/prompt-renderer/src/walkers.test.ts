import { describe, expect, it } from "vitest";
import type { TurnGenPromptTemplate } from "./types";
import { iterDataRefs, iterMessageBlocks } from "./walkers";

describe("walkers", () => {
  // Helper function to collect all items from a generator
  function collectItems<T>(generator: Generator<T>): T[] {
    return Array.from(generator);
  }

  // Helper function to create a minimal template
  function createTemplate(
    overrides: Partial<TurnGenPromptTemplate> = {}
  ): TurnGenPromptTemplate {
    return {
      id: "test",
      name: "Test Template",
      task: "turn_generation",
      version: 1,
      layout: [],
      slots: {},
      ...overrides,
    };
  }

  describe("iterMessageBlocks", () => {
    it("should yield message blocks from layout", () => {
      const template = createTemplate({
        layout: [
          { kind: "message", role: "system", content: "System message" },
          {
            kind: "message",
            role: "user",
            content: "User message",
            prefix: true,
          },
          { kind: "message", role: "assistant", from: { source: "response" } },
        ],
      });

      const blocks = collectItems(iterMessageBlocks(template));

      expect(blocks).toHaveLength(3);
      expect(blocks[0].block).toEqual({
        role: "system",
        content: "System message",
        from: undefined,
        prefix: undefined,
      });
      expect(blocks[0].path).toBe("layout[0]");

      expect(blocks[1].block).toEqual({
        role: "user",
        content: "User message",
        from: undefined,
        prefix: true,
      });
      expect(blocks[1].path).toBe("layout[1]");

      expect(blocks[2].block).toEqual({
        role: "assistant",
        content: undefined,
        from: { source: "response" },
        prefix: undefined,
      });
      expect(blocks[2].path).toBe("layout[2]");
    });

    it("should yield message blocks from slot headers and footers", () => {
      const template = createTemplate({
        layout: [
          {
            kind: "slot",
            name: "content",
            header: { role: "system", content: "Header message" },
            footer: [
              { role: "user", content: "Footer 1" },
              { role: "assistant", content: "Footer 2", prefix: true },
            ],
          },
        ],
        slots: {
          content: {
            priority: 0,
            meta: {},
            plan: [],
          },
        },
      });

      const blocks = collectItems(iterMessageBlocks(template));

      expect(blocks).toHaveLength(3);

      // Header
      expect(blocks[0].block).toEqual({
        role: "system",
        content: "Header message",
        from: undefined,
        prefix: undefined,
      });
      expect(blocks[0].path).toBe("layout[0].header[0]");

      // Footer 1
      expect(blocks[1].block).toEqual({
        role: "user",
        content: "Footer 1",
        from: undefined,
        prefix: undefined,
      });
      expect(blocks[1].path).toBe("layout[0].footer[0]");

      // Footer 2
      expect(blocks[2].block).toEqual({
        role: "assistant",
        content: "Footer 2",
        from: undefined,
        prefix: true,
      });
      expect(blocks[2].path).toBe("layout[0].footer[1]");
    });

    it("should yield message blocks from slot plans", () => {
      const template = createTemplate({
        layout: [{ kind: "slot", name: "someContentSlot" }],
        slots: {
          someContentSlot: {
            priority: 0,
            meta: {},
            plan: [
              { kind: "message", role: "system", content: "Plan message 1" },
              { kind: "message", role: "user", from: { source: "input" } },
            ],
          },
        },
      });

      const blocks = collectItems(iterMessageBlocks(template));

      expect(blocks).toHaveLength(2);
      expect(blocks[0].block).toEqual({
        role: "system",
        content: "Plan message 1",
        from: undefined,
        prefix: undefined,
      });
      expect(blocks[0].path).toBe("slots.someContentSlot.plan[0]");

      expect(blocks[1].block).toEqual({
        role: "user",
        content: undefined,
        from: { source: "input" },
        prefix: undefined,
      });
      expect(blocks[1].path).toBe("slots.someContentSlot.plan[1]");
    });

    it("should yield message blocks from forEach maps", () => {
      const template = createTemplate({
        layout: [{ kind: "slot", name: "items" }],
        slots: {
          items: {
            priority: 0,
            meta: {},
            plan: [
              {
                kind: "forEach",
                source: { source: "items" },
                map: [
                  {
                    kind: "message",
                    role: "user",
                    content: "Item: {{item.name}}",
                  },
                  {
                    kind: "message",
                    role: "assistant",
                    from: { source: "response" },
                  },
                ],
              },
            ],
          },
        },
      });

      const blocks = collectItems(iterMessageBlocks(template));

      expect(blocks).toHaveLength(2);
      expect(blocks[0].block).toEqual({
        role: "user",
        content: "Item: {{item.name}}",
        from: undefined,
        prefix: undefined,
      });
      expect(blocks[0].path).toBe("slots.items.plan[0].forEach.map[0]");

      expect(blocks[1].block).toEqual({
        role: "assistant",
        content: undefined,
        from: { source: "response" },
        prefix: undefined,
      });
      expect(blocks[1].path).toBe("slots.items.plan[0].forEach.map[1]");
    });

    it("should yield message blocks from if/then/else branches", () => {
      const template = createTemplate({
        layout: [{ kind: "slot", name: "conditionalSlot" }],
        slots: {
          conditionalSlot: {
            priority: 0,
            meta: {},
            plan: [
              {
                kind: "if",
                when: { type: "exists", ref: { source: "condition" } },
                then: [
                  { kind: "message", role: "user", content: "Then message" },
                ],
                else: [
                  {
                    kind: "message",
                    role: "system",
                    content: "Else message 1",
                  },
                  {
                    kind: "message",
                    role: "assistant",
                    from: { source: "fallback" },
                  },
                ],
              },
            ],
          },
        },
      });

      const blocks = collectItems(iterMessageBlocks(template));

      expect(blocks).toHaveLength(3);

      // Then branch
      expect(blocks[0].block).toEqual({
        role: "user",
        content: "Then message",
        from: undefined,
        prefix: undefined,
      });
      expect(blocks[0].path).toBe(
        "slots.conditionalSlot.plan[0].if.then[0].plan[0]"
      );

      // Else branch - first message
      expect(blocks[1].block).toEqual({
        role: "system",
        content: "Else message 1",
        from: undefined,
        prefix: undefined,
      });
      expect(blocks[1].path).toBe(
        "slots.conditionalSlot.plan[0].if.else[0].plan[0]"
      );

      // Else branch - second message
      expect(blocks[2].block).toEqual({
        role: "assistant",
        content: undefined,
        from: { source: "fallback" },
        prefix: undefined,
      });
      expect(blocks[2].path).toBe(
        "slots.conditionalSlot.plan[0].if.else[1].plan[0]"
      );
    });

    it("should handle deeply nested structures", () => {
      const template = createTemplate({
        layout: [{ kind: "slot", name: "veryNestedSlot" }],
        slots: {
          veryNestedSlot: {
            priority: 0,
            meta: {},
            plan: [
              {
                kind: "forEach",
                source: { source: "items" },
                map: [
                  {
                    kind: "if",
                    when: { type: "exists", ref: { source: "subItems" } },
                    then: [
                      {
                        kind: "forEach",
                        source: { source: "subItems" },
                        map: [
                          {
                            kind: "message",
                            role: "user",
                            content: "Deeply nested message",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      });

      const blocks = collectItems(iterMessageBlocks(template));

      expect(blocks).toHaveLength(1);
      expect(blocks[0].block).toEqual({
        role: "user",
        content: "Deeply nested message",
        from: undefined,
        prefix: undefined,
      });
      expect(blocks[0].path).toBe(
        "slots.veryNestedSlot.plan[0].forEach.map[0].plan[0].if.then[0].plan[0].forEach.map[0]"
      );
    });

    it("should handle empty templates", () => {
      const template = createTemplate({
        layout: [],
        slots: {
          empty: {
            priority: 0,
            meta: {},
            plan: [],
          },
        },
      });

      const blocks = collectItems(iterMessageBlocks(template));
      expect(blocks).toHaveLength(0);
    });

    it("should handle templates with no slots", () => {
      const template = createTemplate({
        layout: [
          { kind: "message", role: "system", content: "Only layout message" },
        ],
        slots: {},
      });

      const blocks = collectItems(iterMessageBlocks(template));
      expect(blocks).toHaveLength(1);
      expect(blocks[0].path).toBe("layout[0]");
    });

    it("should handle slots without headers or footers", () => {
      const template = createTemplate({
        layout: [
          {
            kind: "slot",
            name: "content",
            // No header or footer
          },
        ],
        slots: {
          content: {
            priority: 0,
            meta: {},
            plan: [{ kind: "message", role: "user", content: "Just content" }],
          },
        },
      });

      const blocks = collectItems(iterMessageBlocks(template));
      expect(blocks).toHaveLength(1);
      expect(blocks[0].path).toBe("slots.content.plan[0]");
    });
  });

  describe("iterDataRefs", () => {
    it("should yield DataRefs from message 'from' fields", () => {
      const template = createTemplate({
        layout: [
          { kind: "message", role: "system", content: "No ref" },
          { kind: "message", role: "user", from: { source: "userInput" } },
          {
            kind: "message",
            role: "assistant",
            from: { source: "response", args: { key: "value" } },
          },
        ],
      });

      const refs = collectItems(iterDataRefs(template));

      expect(refs).toHaveLength(2);
      expect(refs[0].ref).toEqual({ source: "userInput" });
      expect(refs[0].path).toBe("layout[1].from");

      expect(refs[1].ref).toEqual({
        source: "response",
        args: { key: "value" },
      });
      expect(refs[1].path).toBe("layout[2].from");
    });

    it("should yield DataRefs from slot headers and footers", () => {
      const template = createTemplate({
        layout: [
          {
            kind: "slot",
            name: "content",
            header: { role: "system", from: { source: "headerData" } },
            footer: [
              { role: "user", content: "Static footer" },
              { role: "assistant", from: { source: "footerData" } },
            ],
          },
        ],
        slots: {
          content: {
            priority: 0,
            meta: {},
            plan: [],
          },
        },
      });

      const refs = collectItems(iterDataRefs(template));

      expect(refs).toHaveLength(2);
      expect(refs[0].ref).toEqual({ source: "headerData" });
      expect(refs[0].path).toBe("layout[0].header[0]");

      expect(refs[1].ref).toEqual({ source: "footerData" });
      expect(refs[1].path).toBe("layout[0].footer[1]");
    });

    it("should yield DataRefs from slot conditions", () => {
      const template = createTemplate({
        layout: [{ kind: "slot", name: "conditionalSlot" }],
        slots: {
          conditionalSlot: {
            priority: 0,
            meta: {},
            when: {
              type: "exists",
              ref: { source: "condition", args: { test: true } },
            },
            plan: [],
          },
        },
      });

      const refs = collectItems(iterDataRefs(template));

      expect(refs).toHaveLength(1);
      expect(refs[0].ref).toEqual({
        source: "condition",
        args: { test: true },
      });
      expect(refs[0].path).toBe("slots.conditionalSlot.when.ref");
    });

    it("should yield DataRefs from forEach sources", () => {
      const template = createTemplate({
        layout: [{ kind: "slot", name: "items" }],
        slots: {
          items: {
            priority: 0,
            meta: {},
            plan: [
              {
                kind: "forEach",
                source: { source: "items", args: { limit: 10 } },
                map: [{ kind: "message", role: "user", content: "Item" }],
              },
            ],
          },
        },
      });

      const refs = collectItems(iterDataRefs(template));

      expect(refs).toHaveLength(1);
      expect(refs[0].ref).toEqual({ source: "items", args: { limit: 10 } });
      expect(refs[0].path).toBe("slots.items.plan[0].forEach.source");
    });

    it("should yield DataRefs from if conditions", () => {
      const template = createTemplate({
        layout: [{ kind: "slot", name: "conditionalSlot" }],
        slots: {
          conditionalSlot: {
            priority: 0,
            meta: {},
            plan: [
              {
                kind: "if",
                when: { type: "nonEmpty", ref: { source: "checkData" } },
                then: [{ kind: "message", role: "user", content: "Has data" }],
                else: [
                  {
                    kind: "message",
                    role: "user",
                    from: { source: "fallbackData" },
                  },
                ],
              },
            ],
          },
        },
      });

      const refs = collectItems(iterDataRefs(template));

      expect(refs).toHaveLength(2);
      expect(refs[0].ref).toEqual({ source: "checkData" });
      expect(refs[0].path).toBe("slots.conditionalSlot.plan[0].if.when.ref");

      expect(refs[1].ref).toEqual({ source: "fallbackData" });
      expect(refs[1].path).toBe(
        "slots.conditionalSlot.plan[0].if.else[0].plan[0].from"
      );
    });

    it("should handle nested DataRefs in complex structures", () => {
      const template = createTemplate({
        layout: [{ kind: "slot", name: "complex" }],
        slots: {
          complex: {
            priority: 0,
            meta: {},
            when: { type: "exists", ref: { source: "rootCondition" } },
            plan: [
              {
                kind: "forEach",
                source: { source: "outerItems" },
                map: [
                  {
                    kind: "if",
                    when: { type: "exists", ref: { source: "innerCondition" } },
                    then: [
                      {
                        kind: "forEach",
                        source: { source: "innerItems" },
                        map: [
                          {
                            kind: "message",
                            role: "user",
                            from: { source: "messageData" },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      });

      const refs = collectItems(iterDataRefs(template));

      expect(refs).toHaveLength(5);
      expect(refs[0].ref).toEqual({ source: "rootCondition" });
      expect(refs[0].path).toBe("slots.complex.when.ref");

      expect(refs[1].ref).toEqual({ source: "outerItems" });
      expect(refs[1].path).toBe("slots.complex.plan[0].forEach.source");

      expect(refs[2].ref).toEqual({ source: "innerCondition" });
      expect(refs[2].path).toBe(
        "slots.complex.plan[0].forEach.map[0].plan[0].if.when.ref"
      );

      expect(refs[3].ref).toEqual({ source: "innerItems" });
      expect(refs[3].path).toBe(
        "slots.complex.plan[0].forEach.map[0].plan[0].if.then[0].plan[0].forEach.source"
      );

      expect(refs[4].ref).toEqual({ source: "messageData" });
      expect(refs[4].path).toBe(
        "slots.complex.plan[0].forEach.map[0].plan[0].if.then[0].plan[0].forEach.map[0].plan[0].from"
      );
    });

    it("should handle templates without DataRefs", () => {
      const template = createTemplate({
        layout: [
          { kind: "message", role: "system", content: "Static content" },
        ],
        slots: {
          simple: {
            priority: 0,
            meta: {},
            plan: [
              { kind: "message", role: "user", content: "Static message" },
            ],
          },
        },
      });

      const refs = collectItems(iterDataRefs(template));
      expect(refs).toHaveLength(0);
    });

    it("should handle DataRefs with complex args", () => {
      const complexArgs = {
        order: "desc",
        limit: 5,
        filters: { type: "active", category: ["A", "B"] },
      };

      const template = createTemplate({
        layout: [
          {
            kind: "message",
            role: "system",
            from: { source: "config", args: complexArgs },
          },
        ],
      });

      const refs = collectItems(iterDataRefs(template));

      expect(refs).toHaveLength(1);
      expect(refs[0].ref).toEqual({ source: "config", args: complexArgs });
      expect(refs[0].path).toBe("layout[0].from");
    });

    it("should yield DataRefs from forEach with message refs in maps", () => {
      const template = createTemplate({
        layout: [{ kind: "slot", name: "items" }],
        slots: {
          items: {
            priority: 0,
            meta: {},
            plan: [
              {
                kind: "forEach",
                source: { source: "items" },
                map: [
                  { kind: "message", role: "user", from: { source: "prefix" } },
                  { kind: "message", role: "assistant", content: "Static" },
                  { kind: "message", role: "user", from: { source: "suffix" } },
                ],
              },
            ],
          },
        },
      });

      const refs = collectItems(iterDataRefs(template));

      expect(refs).toHaveLength(3);
      expect(refs[0].ref).toEqual({ source: "items" });
      expect(refs[0].path).toBe("slots.items.plan[0].forEach.source");

      expect(refs[1].ref).toEqual({ source: "prefix" });
      expect(refs[1].path).toBe(
        "slots.items.plan[0].forEach.map[0].plan[0].from"
      );

      expect(refs[2].ref).toEqual({ source: "suffix" });
      expect(refs[2].path).toBe(
        "slots.items.plan[0].forEach.map[2].plan[0].from"
      );
    });
  });

  describe("path generation", () => {
    it("should generate consistent path formats", () => {
      const template = createTemplate({
        layout: [{ kind: "slot", name: "test" }],
        slots: {
          test: {
            priority: 0,
            meta: {},
            plan: [
              {
                kind: "forEach",
                source: { source: "items" },
                map: [
                  {
                    kind: "if",
                    when: { type: "exists", ref: { source: "condition" } },
                    then: [{ kind: "message", role: "user", content: "Test" }],
                  },
                ],
              },
            ],
          },
        },
      });

      const messageBlocks = collectItems(iterMessageBlocks(template));
      const dataRefs = collectItems(iterDataRefs(template));

      // Check that paths follow consistent format
      expect(messageBlocks[0].path).toMatch(
        /^slots\.test\.plan\[\d+\]\.forEach\.map\[\d+\]\.plan\[\d+\]\.if\.then\[\d+\]\.plan\[\d+\]$/
      );
      expect(dataRefs[0].path).toMatch(
        /^slots\.test\.plan\[\d+\]\.forEach\.source$/
      );
      expect(dataRefs[1].path).toMatch(
        /^slots\.test\.plan\[\d+\]\.forEach\.map\[\d+\]\.plan\[\d+\]\.if\.when\.ref$/
      );
    });
  });
});
