import { describe, expect, it } from "vitest";
import { TemplateStructureError } from "./errors";
import type { PromptTemplate } from "./types";
import { validateTemplateStructure } from "./validator";

describe("validateTemplateStructure", () => {
  const validTemplate: PromptTemplate = {
    id: "test_template",
    name: "Test Template",
    task: "turn_generation",
    version: 1,
    layout: [
      { kind: "message", role: "system", content: "System message" },
      { kind: "slot", name: "content" },
      { kind: "separator", text: "---" },
    ],
    slots: {
      content: {
        priority: 0,
        plan: [
          { kind: "message", role: "user", content: "User message" },
          {
            kind: "message",
            role: "assistant",
            content: "Assistant response",
            prefix: true,
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
      const invalidTemplate: PromptTemplate = {
        ...validTemplate,
        layout: [
          { kind: "message", role: "system", content: "System message" },
          { kind: "slot", name: "missing_slot" },
        ],
      };

      expect(() => validateTemplateStructure(invalidTemplate)).toThrow(
        TemplateStructureError
      );
      expect(() => validateTemplateStructure(invalidTemplate)).toThrow(
        'Layout references non-existent slot: "missing_slot"'
      );
    });

    it("should pass when all slot references exist", () => {
      const validMultiSlotTemplate: PromptTemplate = {
        ...validTemplate,
        layout: [
          { kind: "slot", name: "content" },
          { kind: "slot", name: "summary" },
        ],
        slots: {
          content: { priority: 0, plan: [] },
          summary: { priority: 1, plan: [] },
        },
      };

      expect(() =>
        validateTemplateStructure(validMultiSlotTemplate)
      ).not.toThrow();
    });
  });

  describe("assistant prefix validation", () => {
    it("should allow prefix:true on assistant role messages", () => {
      const validPrefixTemplate: PromptTemplate = {
        ...validTemplate,
        layout: [
          {
            kind: "message",
            role: "assistant",
            content: "Start here",
            prefix: true,
          },
        ],
      };

      expect(() =>
        validateTemplateStructure(validPrefixTemplate)
      ).not.toThrow();
    });

    it("should throw for prefix:true on non-assistant role in layout", () => {
      const invalidPrefixTemplate: PromptTemplate = {
        ...validTemplate,
        layout: [
          {
            kind: "message",
            role: "user",
            content: "User message",
            prefix: true,
          },
        ],
      };

      expect(() => validateTemplateStructure(invalidPrefixTemplate)).toThrow(
        TemplateStructureError
      );
      expect(() => validateTemplateStructure(invalidPrefixTemplate)).toThrow(
        "prefix:true can only be used with role:'assistant', found on role:'user'"
      );
    });

    it("should throw for prefix:true on non-assistant role in slot plan", () => {
      const invalidSlotPrefixTemplate: PromptTemplate = {
        ...validTemplate,
        slots: {
          content: {
            priority: 0,
            plan: [
              {
                kind: "message",
                role: "user",
                content: "User message",
                prefix: true,
              },
            ],
          },
        },
      };

      expect(() =>
        validateTemplateStructure(invalidSlotPrefixTemplate)
      ).toThrow(TemplateStructureError);
      expect(() =>
        validateTemplateStructure(invalidSlotPrefixTemplate)
      ).toThrow(
        "prefix:true can only be used with role:'assistant', found on role:'user' at slots.content.plan[0]"
      );
    });

    it("should throw for prefix:true in nested plan nodes", () => {
      const nestedInvalidTemplate: PromptTemplate = {
        ...validTemplate,
        slots: {
          content: {
            priority: 0,
            plan: [
              {
                kind: "forEach",
                source: { source: "items" },
                map: [
                  {
                    kind: "message",
                    role: "system",
                    content: "Nested",
                    prefix: true,
                  },
                ],
              },
            ],
          },
        },
      };

      expect(() => validateTemplateStructure(nestedInvalidTemplate)).toThrow(
        TemplateStructureError
      );
      expect(() => validateTemplateStructure(nestedInvalidTemplate)).toThrow(
        "prefix:true can only be used with role:'assistant', found on role:'system' at slots.content.plan[0].forEach.map[0]"
      );
    });

    it("should throw for prefix:true in if node", () => {
      const ifInvalidTemplate: PromptTemplate = {
        ...validTemplate,
        slots: {
          content: {
            priority: 0,
            plan: [
              {
                kind: "if",
                when: { type: "exists", ref: { source: "test" } },
                then: [
                  {
                    kind: "message",
                    role: "user",
                    content: "In then",
                    prefix: true,
                  },
                ],
                else: [
                  {
                    kind: "message",
                    role: "system",
                    content: "In else",
                    prefix: true,
                  },
                ],
              },
            ],
          },
        },
      };

      expect(() => validateTemplateStructure(ifInvalidTemplate)).toThrow(
        TemplateStructureError
      );
      expect(() => validateTemplateStructure(ifInvalidTemplate)).toThrow(
        "prefix:true can only be used with role:'assistant', found on role:'user' at slots.content.plan[0].if.then[0].plan[0]"
      );
    });
  });

  describe("edge cases", () => {
    it("should handle templates with no slots", () => {
      const noSlotsTemplate: PromptTemplate = {
        ...validTemplate,
        layout: [
          { kind: "message", role: "system", content: "Just a message" },
        ],
        slots: {},
      };

      expect(() => validateTemplateStructure(noSlotsTemplate)).not.toThrow();
    });

    it("should handle templates with empty layout", () => {
      const emptyLayoutTemplate: PromptTemplate = {
        ...validTemplate,
        layout: [],
      };

      expect(() =>
        validateTemplateStructure(emptyLayoutTemplate)
      ).not.toThrow();
    });

    it("should handle undefined prefix (should not throw)", () => {
      const undefinedPrefixTemplate: PromptTemplate = {
        ...validTemplate,
        layout: [
          { kind: "message", role: "user", content: "No prefix defined" },
        ],
      };

      expect(() =>
        validateTemplateStructure(undefinedPrefixTemplate)
      ).not.toThrow();
    });

    it("should handle false prefix (should not throw)", () => {
      const falsePrefixTemplate: PromptTemplate = {
        ...validTemplate,
        layout: [
          {
            kind: "message",
            role: "user",
            content: "Explicit false",
            prefix: false,
          },
        ],
      };

      expect(() =>
        validateTemplateStructure(falsePrefixTemplate)
      ).not.toThrow();
    });
  });
});
