import { describe, expect, it } from "vitest";
import { TemplateStructureError } from "./errors.js";
import type { PromptTemplate } from "./types.js";
import { validateTemplateStructure } from "./validator.js";

describe("validateTemplateStructure", () => {
  const validTemplate: PromptTemplate<any, any> = {
    id: "test_template",
    name: "Test Template",
    task: "turn_generation",
    version: 1,
    layout: [
      { kind: "message", role: "system", content: "System message" },
      { kind: "slot", name: "content" },
    ],
    slots: {
      content: {
        priority: 0,
        meta: {},
        plan: [
          { kind: "message", role: "user", content: "User message" },
          {
            kind: "message",
            role: "assistant",
            content: "Assistant response",
          },
        ],
      },
    },
  };

  it("should pass validation for a valid template", () => {
    expect(() => validateTemplateStructure(validTemplate)).not.toThrow();
  });

  describe("slot name validation", () => {
    it("should throw for missing slot reference in layout", () => {
      const invalidTemplate: PromptTemplate<any, any> = {
        ...validTemplate,
        layout: [
          { kind: "message", role: "system", content: "System message" },
          { kind: "slot", name: "missing_slot" },
        ],
      };

      expect(() => validateTemplateStructure(invalidTemplate)).toThrow(TemplateStructureError);
      expect(() => validateTemplateStructure(invalidTemplate)).toThrow(
        'Layout references non-existent slot: "missing_slot"'
      );
    });

    it("should pass when all slot references exist", () => {
      const validMultiSlotTemplate: PromptTemplate<any, any> = {
        ...validTemplate,
        layout: [
          { kind: "slot", name: "content" },
          { kind: "slot", name: "summary" },
        ],
        slots: {
          content: { priority: 0, meta: {}, plan: [] },
          summary: { priority: 1, meta: {}, plan: [] },
        },
      };

      expect(() => validateTemplateStructure(validMultiSlotTemplate)).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("should handle templates with no slots", () => {
      const noSlotsTemplate: PromptTemplate<any, any> = {
        ...validTemplate,
        layout: [{ kind: "message", role: "system", content: "Just a message" }],
        slots: {},
      };

      expect(() => validateTemplateStructure(noSlotsTemplate)).not.toThrow();
    });

    it("should handle templates with empty layout", () => {
      const emptyLayoutTemplate: PromptTemplate<any, any> = {
        ...validTemplate,
        layout: [],
      };

      expect(() => validateTemplateStructure(emptyLayoutTemplate)).not.toThrow();
    });
  });
});
