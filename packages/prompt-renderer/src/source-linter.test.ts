import { describe, expect, it } from "vitest";
import { AuthoringValidationError } from "./errors";
import { extractAllSourceNames, lintSourceNames } from "./source-linter";
import type { PromptTemplate } from "./types";

describe("source-linter", () => {
  const sampleTemplate: PromptTemplate = {
    id: "test_template",
    name: "Test Template",
    task: "turn_generation",
    version: 1,
    layout: [
      { kind: "message", role: "system", content: "System message" },
      {
        kind: "message",
        role: "user",
        from: { source: "turns", args: { limit: 1 } },
      },
      { kind: "slot", name: "content" },
    ],
    slots: {
      content: {
        priority: 0,
        meta: {},
        when: { type: "exists", ref: { source: "characters" } },
        plan: [
          {
            kind: "forEach",
            source: { source: "turns", args: { order: "desc" } },
            map: [
              {
                kind: "message",
                role: "user",
                from: { source: "chapterSummaries" },
              },
              {
                kind: "if",
                when: { type: "nonEmpty", ref: { source: "intent" } },
                then: [
                  { kind: "message", role: "assistant", content: "Response" },
                ],
                else: [
                  {
                    kind: "message",
                    role: "user",
                    from: { source: "stepOutput", args: { key: "plan" } },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };

  describe("extractAllSourceNames", () => {
    it("should extract all unique source names from template", () => {
      const sources = extractAllSourceNames(sampleTemplate);
      expect(sources).toEqual([
        "chapterSummaries",
        "characters",
        "intent",
        "stepOutput",
        "turns",
      ]);
    });

    it("should handle template with no DataRefs", () => {
      const emptyTemplate: PromptTemplate = {
        id: "empty",
        name: "Empty Template",
        task: "turn_generation",
        version: 1,
        layout: [
          { kind: "message", role: "system", content: "Static message" },
        ],
        slots: {},
      };

      const sources = extractAllSourceNames(emptyTemplate);
      expect(sources).toEqual([]);
    });

    it("should handle duplicates correctly", () => {
      const duplicateTemplate: PromptTemplate = {
        id: "dup",
        name: "Duplicate Template",
        task: "turn_generation",
        version: 1,
        layout: [{ kind: "message", role: "user", from: { source: "turns" } }],
        slots: {
          slot1: {
            priority: 0,
            meta: {},
            plan: [
              {
                kind: "forEach",
                source: { source: "turns" }, // Same source
                map: [
                  { kind: "message", role: "user", from: { source: "turns" } }, // Same source again
                ],
              },
            ],
          },
        },
      };

      const sources = extractAllSourceNames(duplicateTemplate);
      expect(sources).toEqual(["turns"]); // Should only appear once
    });

    it("should extract from slot conditions", () => {
      const conditionTemplate: PromptTemplate = {
        id: "cond",
        name: "Condition Template",
        task: "turn_generation",
        version: 1,
        layout: [],
        slots: {
          conditional: {
            priority: 0,
            meta: {},
            when: { type: "exists", ref: { source: "specialData" } },
            plan: [],
          },
        },
      };

      const sources = extractAllSourceNames(conditionTemplate);
      expect(sources).toEqual(["specialData"]);
    });

    it("should extract from nested if/else blocks", () => {
      const nestedTemplate: PromptTemplate = {
        id: "nested",
        name: "Nested Template",
        task: "turn_generation",
        version: 1,
        layout: [],
        slots: {
          nested: {
            priority: 0,
            meta: {},
            plan: [
              {
                kind: "if",
                when: { type: "exists", ref: { source: "condition1" } },
                then: [
                  {
                    kind: "forEach",
                    source: { source: "source1" },
                    map: [
                      {
                        kind: "if",
                        when: {
                          type: "nonEmpty",
                          ref: { source: "condition2" },
                        },
                        then: [
                          {
                            kind: "message",
                            role: "user",
                            from: { source: "source2" },
                          },
                        ],
                        else: [
                          {
                            kind: "message",
                            role: "user",
                            from: { source: "source3" },
                          },
                        ],
                      },
                    ],
                  },
                ],
                else: [
                  {
                    kind: "message",
                    role: "user",
                    from: { source: "source4" },
                  },
                ],
              },
            ],
          },
        },
      };

      const sources = extractAllSourceNames(nestedTemplate);
      expect(sources).toEqual([
        "condition1",
        "condition2",
        "source1",
        "source2",
        "source3",
        "source4",
      ]);
    });
  });

  describe("lintSourceNames", () => {
    const allowedSources = new Set([
      "turns",
      "characters",
      "chapterSummaries",
      "intent",
    ]);

    it("should pass when all sources are allowed", () => {
      const validTemplate: PromptTemplate = {
        ...sampleTemplate,
        slots: {
          content: {
            priority: 0,
            meta: {},
            plan: [
              {
                kind: "forEach",
                source: { source: "turns" },
                map: [
                  {
                    kind: "message",
                    role: "user",
                    from: { source: "characters" },
                  },
                ],
              },
            ],
          },
        },
      };

      expect(() =>
        lintSourceNames(validTemplate, allowedSources)
      ).not.toThrow();
    });

    it("should throw for unknown source names", () => {
      const invalidTemplate: PromptTemplate = {
        id: "invalid",
        name: "Invalid Template",
        task: "turn_generation",
        version: 1,
        layout: [
          { kind: "message", role: "user", from: { source: "unknownSource" } },
        ],
        slots: {},
      };

      expect(() => lintSourceNames(invalidTemplate, allowedSources)).toThrow(
        AuthoringValidationError
      );
      expect(() => lintSourceNames(invalidTemplate, allowedSources)).toThrow(
        "Unknown source names found: unknownSource"
      );
    });

    it("should throw for multiple unknown source names", () => {
      const multiInvalidTemplate: PromptTemplate = {
        id: "multi-invalid",
        name: "Multi Invalid Template",
        task: "turn_generation",
        version: 1,
        layout: [],
        slots: {
          content: {
            priority: 0,
            meta: {},
            plan: [
              {
                kind: "forEach",
                source: { source: "unknown1" },
                map: [
                  {
                    kind: "message",
                    role: "user",
                    from: { source: "unknown2" },
                  },
                ],
              },
            ],
          },
        },
      };

      expect(() =>
        lintSourceNames(multiInvalidTemplate, allowedSources)
      ).toThrow("Unknown source names found: unknown1, unknown2");
    });

    it("should not validate when allowedSources is undefined", () => {
      const invalidTemplate: PromptTemplate = {
        id: "no-validation",
        name: "No Validation Template",
        task: "turn_generation",
        version: 1,
        layout: [
          {
            kind: "message",
            role: "user",
            from: { source: "anyUnknownSource" },
          },
        ],
        slots: {},
      };

      // Should not throw when no allowed sources provided
      expect(() => lintSourceNames(invalidTemplate, undefined)).not.toThrow();
      expect(() => lintSourceNames(invalidTemplate)).not.toThrow();
    });

    it("should handle empty allowed sources set", () => {
      const emptySources = new Set<string>();
      const templateWithSources: PromptTemplate = {
        ...sampleTemplate,
        layout: [
          { kind: "message", role: "user", from: { source: "anySource" } },
        ],
      };

      expect(() => lintSourceNames(templateWithSources, emptySources)).toThrow(
        AuthoringValidationError
      );
      expect(() => lintSourceNames(templateWithSources, emptySources)).toThrow(
        "Unknown source names found: anySource"
      );
    });

    it("should handle template with no sources against allowed sources", () => {
      const noSourcesTemplate: PromptTemplate = {
        id: "empty",
        name: "Empty Template",
        task: "turn_generation",
        version: 1,
        layout: [
          { kind: "message", role: "system", content: "Static message" },
        ],
        slots: {},
      };

      expect(() =>
        lintSourceNames(noSourcesTemplate, allowedSources)
      ).not.toThrow();
    });
  });
});
