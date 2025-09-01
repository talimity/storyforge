import { describe, expect, it } from "vitest";
import { parseTemplate } from "./schemas.js";

describe("schema validation", () => {
  describe("parseTemplate", () => {
    it("should parse a valid minimal template", () => {
      const validTemplate = {
        id: "test_template",
        name: "Test Template",
        task: "turn_generation",
        version: 1,
        layout: [
          {
            kind: "message",
            role: "system",
            content: "You are a helpful assistant.",
          },
        ],
        slots: {},
      };

      const result = parseTemplate(validTemplate);
      expect(result).toEqual(validTemplate);
    });

    it("should parse a complex template with slots and plan nodes", () => {
      const complexTemplate = {
        id: "complex_template",
        name: "Complex Template",
        description: "A complex template with slots and plan nodes",
        task: "turn_generation",
        version: 1,
        layout: [
          { kind: "message", role: "system", content: "System message" },
          { kind: "slot", name: "turns", omitIfEmpty: true },
        ],
        slots: {
          turns: {
            priority: 0,
            budget: { maxTokens: 1000 },
            meta: { recipe: "recent_turns" },
            plan: [
              {
                kind: "forEach",
                source: { source: "turns", args: { limit: 5 } },
                map: [
                  {
                    kind: "message",
                    role: "user",
                    content: "Turn: {{item.summary}}",
                  },
                ],
              },
            ],
          },
        },
      };

      const result = parseTemplate(complexTemplate);
      expect(result).toEqual(complexTemplate);
    });

    it("should parse template with conditions", () => {
      const templateWithConditions = {
        id: "conditional_template",
        name: "Conditional Template",
        task: "turn_generation",
        version: 1,
        layout: [{ kind: "slot", name: "conditional_content" }],
        slots: {
          conditional_content: {
            priority: 0,
            meta: {},
            when: { type: "exists", ref: { source: "turns" } },
            plan: [
              {
                kind: "if",
                when: { type: "nonEmpty", ref: { source: "turns" } },
                then: [
                  {
                    kind: "message",
                    role: "user",
                    content: "There are turns available",
                  },
                ],
                else: [
                  {
                    kind: "message",
                    role: "user",
                    content: "No turns available",
                  },
                ],
              },
            ],
          },
        },
      };

      const result = parseTemplate(templateWithConditions);
      expect(result).toEqual(templateWithConditions);
    });

    it("should throw on invalid template structure", () => {
      const invalidTemplate = {
        id: "invalid",
        // missing required fields
      };

      expect(() => parseTemplate(invalidTemplate)).toThrow();
    });

    it("should throw on invalid role", () => {
      const invalidRole = {
        id: "test",
        name: "Test",
        task: "turn_generation",
        version: 1,
        layout: [{ kind: "message", role: "invalid_role", content: "test" }],
        slots: {},
      };

      expect(() => parseTemplate(invalidRole)).toThrow("invalid_value");
    });

    it("should throw on invalid plan node kind", () => {
      const invalidPlanNode = {
        id: "test",
        name: "Test",
        task: "turn_generation",
        version: 1,
        layout: [],
        slots: {
          test: {
            priority: 0,
            plan: [{ kind: "invalid_kind", content: "test" }],
          },
        },
      };

      expect(() => parseTemplate(invalidPlanNode)).toThrow("invalid_union");
    });

    it("should throw on invalid condition type", () => {
      const invalidCondition = {
        id: "test",
        name: "Test",
        task: "turn_generation",
        version: 1,
        layout: [],
        slots: {
          test: {
            priority: 0,
            when: { type: "invalid_condition", ref: { source: "test" } },
            plan: [],
          },
        },
      };

      expect(() => parseTemplate(invalidCondition)).toThrow("invalid_union");
    });

    it("should handle recursive plan nodes", () => {
      const recursiveTemplate = {
        id: "recursive",
        name: "Recursive Template",
        task: "turn_generation",
        version: 1,
        layout: [{ kind: "slot", name: "nested" }],
        slots: {
          nested: {
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
                            content: "Nested item",
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
      };

      const result = parseTemplate(recursiveTemplate);
      expect(result).toEqual(recursiveTemplate);
    });
  });
});
