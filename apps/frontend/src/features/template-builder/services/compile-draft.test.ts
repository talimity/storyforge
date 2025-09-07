import { describe, expect, it } from "vitest";
import {
  compileDraft,
  DraftCompilationError,
  validateDraft,
} from "@/features/template-builder/services/compile-draft";
import type { TemplateDraft } from "@/features/template-builder/types";

describe("compileDraft", () => {
  it("should compile a simple template draft with timeline recipe", () => {
    const draft: TemplateDraft = {
      id: "test_template_1",
      name: "Test Template",
      description: "This is a test template",
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
            turnTemplate: "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}",
            budget: 2000,
          },
          name: "timeline",
          priority: 0,
          budget: 2000,
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
    expect(compiled.slots.timeline.budget?.maxTokens).toBe(2000);
  });
});

describe("validateDraft", () => {
  it("should return no errors for valid draft", () => {
    const draft: TemplateDraft = {
      id: "valid_template",
      name: "Valid Template",
      description: "This is a valid template",
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
      description: "This template has an unknown slot",
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
      description: "This template has an unknown recipe",
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
    expect(errors).toContain("Slot 'timeline' uses unknown recipe: unknown_recipe");
  });

  it("should detect unreachable slots", () => {
    const draft: TemplateDraft = {
      id: "unreachable_slot_test",
      name: "Unreachable Slot Test",
      description: "This template has an unused slot",
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
    expect(errors).toContain("Slot 'unused_slot' is defined but never referenced in layout");
  });
});

describe("content vs from mutual exclusivity", () => {
  it("should throw error for layout message with both content and from", () => {
    const draft: TemplateDraft = {
      id: "content_from_test",
      name: "Content From Test",
      description: "This template has a message with both content and from",
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
      description: "This template has a slot header with both content and from",
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
