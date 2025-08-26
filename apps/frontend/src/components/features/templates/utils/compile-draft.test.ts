import { describe, expect, it } from "vitest";
import type { TemplateDraft } from "../types";
import {
  compileDraft,
  DraftCompilationError,
  validateDraft,
} from "./compile-draft";

describe("compileDraft", () => {
  it("should compile a simple template draft with timeline recipe", () => {
    const draft: TemplateDraft = {
      id: "test_template_1",
      name: "Test Template",
      version: 1,
      task: "turn_generation",
      layoutDraft: [
        {
          id: "msg_1",
          kind: "message",
          role: "system",
          content: "You are a helpful assistant.",
        },
        {
          id: "slot_1",
          kind: "slot",
          name: "timeline",
        },
      ],
      slotsDraft: {
        timeline: {
          recipeId: "timeline_basic",
          params: {
            maxTurns: 5,
            order: "desc",
            turnTemplate:
              "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}",
            budget: 800,
          },
          name: "timeline",
          priority: 0,
          budget: 800,
        },
      },
    };

    const compiled = compileDraft(draft);

    expect(compiled.id).toBe("test_template_1");
    expect(compiled.task).toBe("turn_generation");
    expect(compiled.name).toBe("Test Template");
    expect(compiled.version).toBe(1);
    expect(compiled.layout).toHaveLength(2);
    expect(compiled.layout[0]).toEqual({
      kind: "message",
      role: "system",
      content: "You are a helpful assistant.",
    });
    expect(compiled.layout[1]).toEqual({
      kind: "slot",
      name: "timeline",
    });
    expect(compiled.slots.timeline).toBeDefined();
    expect(compiled.slots.timeline.priority).toBe(0);
    expect(compiled.slots.timeline.budget?.maxTokens).toBe(800);
  });

  it("should compile layout with separator", () => {
    const draft: TemplateDraft = {
      id: "test_template_2",
      name: "Test with Separator",
      version: 1,
      task: "turn_generation",
      layoutDraft: [
        {
          id: "msg_1",
          kind: "message",
          role: "user",
          content: "First message",
        },
        {
          id: "sep_1",
          kind: "separator",
          text: "---",
        },
        {
          id: "msg_2",
          kind: "message",
          role: "user",
          content: "Second message",
        },
      ],
      slotsDraft: {},
    };

    const compiled = compileDraft(draft);

    expect(compiled.layout).toHaveLength(3);
    expect(compiled.layout[1]).toEqual({
      kind: "separator",
      text: "---",
    });
  });
});

describe("validateDraft", () => {
  it("should return no errors for valid draft", () => {
    const draft: TemplateDraft = {
      id: "valid_template",
      name: "Valid Template",
      version: 1,
      task: "turn_generation",
      layoutDraft: [
        {
          id: "slot_1",
          kind: "slot",
          name: "timeline",
        },
      ],
      slotsDraft: {
        timeline: {
          recipeId: "timeline_basic",
          params: {},
          name: "timeline",
          priority: 0,
        },
      },
    };

    const errors = validateDraft(draft);
    expect(errors).toHaveLength(0);
  });

  it("should detect unknown slot reference", () => {
    const draft: TemplateDraft = {
      id: "invalid_template",
      name: "Invalid Template",
      version: 1,
      task: "turn_generation",
      layoutDraft: [
        {
          id: "slot_1",
          kind: "slot",
          name: "unknown_slot",
        },
      ],
      slotsDraft: {
        timeline: {
          recipeId: "timeline_basic",
          params: {},
          name: "timeline",
          priority: 0,
        },
      },
    };

    const errors = validateDraft(draft);
    expect(errors).toContain("Layout references unknown slot: unknown_slot");
  });

  it("should detect unknown recipe ID", () => {
    const draft: TemplateDraft = {
      id: "invalid_recipe",
      name: "Invalid Recipe",
      version: 1,
      task: "turn_generation",
      layoutDraft: [],
      slotsDraft: {
        timeline: {
          recipeId: "unknown_recipe" as any,
          params: {},
          name: "timeline",
          priority: 0,
        },
      },
    };

    const errors = validateDraft(draft);
    expect(errors).toContain(
      "Slot 'timeline' uses unknown recipe: unknown_recipe"
    );
  });

  it("should detect unreachable slots", () => {
    const draft: TemplateDraft = {
      id: "unreachable_slot_test",
      name: "Unreachable Slot Test",
      version: 1,
      task: "turn_generation",
      layoutDraft: [
        {
          id: "slot_1",
          kind: "slot",
          name: "timeline",
        },
      ],
      slotsDraft: {
        timeline: {
          recipeId: "timeline_basic",
          params: {},
          name: "timeline",
          priority: 0,
        },
        unused_slot: {
          recipeId: "characters_basic",
          params: {},
          name: "unused_slot",
          priority: 1,
        },
      },
    };

    const errors = validateDraft(draft);
    expect(errors).toContain(
      "Slot 'unused_slot' is defined but never referenced in layout"
    );
  });
});

describe("budget override propagation", () => {
  it("should override nested forEach budgets when slot budget is set", () => {
    const draft: TemplateDraft = {
      id: "budget_test",
      name: "Budget Override Test",
      version: 1,
      task: "turn_generation",
      layoutDraft: [
        {
          id: "slot_1",
          kind: "slot",
          name: "timeline",
        },
      ],
      slotsDraft: {
        timeline: {
          recipeId: "timeline_basic",
          params: {
            maxTurns: 5,
            order: "desc",
            budget: 800, // Recipe default, should be overridden
          },
          name: "timeline",
          priority: 0,
          budget: 1200, // UI override
        },
      },
    };

    const compiled = compileDraft(draft);

    // Check that slot-level budget is set
    expect(compiled.slots.timeline.budget?.maxTokens).toBe(1200);

    // Check that nested forEach budget is also overridden
    const forEachNode = compiled.slots.timeline.plan[0];
    expect(forEachNode.kind).toBe("forEach");
    if (forEachNode.kind === "forEach") {
      expect(forEachNode.budget?.maxTokens).toBe(1200);
    }
  });
});

describe("content vs from mutual exclusivity", () => {
  it("should throw error for layout message with both content and from", () => {
    const draft: TemplateDraft = {
      id: "content_from_test",
      name: "Content From Test",
      version: 1,
      task: "turn_generation",
      layoutDraft: [
        {
          id: "msg_1",
          kind: "message",
          role: "user",
          content: "Some content",
          from: { source: "turns", args: { limit: 1 } },
        },
      ],
      slotsDraft: {},
    };

    expect(() => compileDraft(draft)).toThrow(DraftCompilationError);
    expect(() => compileDraft(draft)).toThrow(
      "Layout message node cannot have both 'content' and 'from' properties"
    );
  });

  it("should throw error for slot header/footer with both content and from", () => {
    const draft: TemplateDraft = {
      id: "header_content_from_test",
      name: "Header Content From Test",
      version: 1,
      task: "turn_generation",
      layoutDraft: [
        {
          id: "slot_1",
          kind: "slot",
          name: "timeline",
          header: {
            role: "user",
            content: "Header text",
            from: { source: "intent" },
          },
        },
      ],
      slotsDraft: {
        timeline: {
          recipeId: "timeline_basic",
          params: {},
          name: "timeline",
          priority: 0,
        },
      },
    };

    expect(() => compileDraft(draft)).toThrow(DraftCompilationError);
    expect(() => compileDraft(draft)).toThrow(
      "Message block cannot have both 'content' and 'from' properties"
    );
  });
});
