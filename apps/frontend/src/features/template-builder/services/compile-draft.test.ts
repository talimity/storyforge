import { describe, expect, it } from "vitest";
import { ensureChapterSeparatorAttachmentDraft } from "@/features/template-builder/services/attachments/chapters";
import { ensureLoreAttachmentDraft } from "@/features/template-builder/services/attachments/lore";
import {
  compileDraft,
  DraftCompilationError,
  validateDraft,
} from "@/features/template-builder/services/compile-draft";
import type { TemplateDraft } from "@/features/template-builder/types";

function createDefaultAttachmentDrafts(): TemplateDraft["attachmentDrafts"] {
  const lore = ensureLoreAttachmentDraft();
  const chapters = ensureChapterSeparatorAttachmentDraft();
  return {
    [lore.laneId]: lore,
    [chapters.laneId]: chapters,
  };
}

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
            turnTemplate: "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}",
            budget: 2000,
          },
          name: "timeline",
          priority: 0,
          budget: 2000,
        },
      },
      attachmentDrafts: createDefaultAttachmentDrafts(),
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

  it("applies chapter limit parameters to the timeline turns source", () => {
    const draft: TemplateDraft = {
      id: "timeline_chapter_limit",
      name: "Timeline Chapter Limit Template",
      description: "Tests chapter limit parameters",
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
            maxTurns: 20,
            turnTemplate: "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}",
            chapterWindowEnabled: true,
            chapterWindowPreset: "custom",
            chapterWindowStartOffset: -2,
            chapterWindowEndOffset: 0,
            chapterWindowRequireMinTurns: true,
            chapterWindowMinTurns: 35,
          },
          name: "timeline",
          priority: 0,
        },
      },
      attachmentDrafts: createDefaultAttachmentDrafts(),
    };

    const compiled = compileDraft(draft);
    const forEachNode = compiled.slots.timeline.plan[0];
    if (!forEachNode || forEachNode.kind !== "forEach") {
      throw new Error("Expected first plan node to be a forEach node");
    }

    if (!("args" in forEachNode.source) || !forEachNode.source.args) {
      throw new Error("Expected turns source to include chapter window args");
    }

    expect(forEachNode.source.args.chapterWindow).toEqual({
      startOffset: -2,
      endOffset: 0,
      minTurns: 20,
    });
  });

  it("should compile a chapter summaries recipe", () => {
    const draft: TemplateDraft = {
      id: "chapter_summaries_template",
      name: "Chapter Summary Template",
      description: "Tests chapter summaries recipe",
      task: "turn_generation",
      layoutDraft: [
        {
          id: "slot_1",
          kind: "slot",
          name: "summaries",
        },
      ],
      slotsDraft: {
        summaries: {
          recipeId: "chapter_summaries_basic",
          params: {},
          name: "summaries",
          priority: 0,
        },
      },
      attachmentDrafts: createDefaultAttachmentDrafts(),
    };

    const compiled = compileDraft(draft);
    const forEachNode = compiled.slots.summaries.plan[0];
    if (!forEachNode || forEachNode.kind !== "forEach") {
      throw new Error("Expected plan to begin with a forEach node");
    }

    expect(forEachNode.source).toEqual({ source: "chapterSummaries" });
    expect(forEachNode.limit).toBe(20);

    const messageNode = forEachNode.map[0];
    expect(messageNode).toEqual({
      kind: "message",
      role: "user",
      content:
        "{{#if item.title}}[Ch.{{item.chapterNumber}} - {{item.title}}]{{#else}}[Chapter {{item.chapterNumber}}]{{#endif}}\n{{#if item.summaryText}}{{item.summaryText}}{{#else}}No summary available.{{#endif}}\n",
    });
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
      attachmentDrafts: createDefaultAttachmentDrafts(),
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
      attachmentDrafts: createDefaultAttachmentDrafts(),
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
      attachmentDrafts: createDefaultAttachmentDrafts(),
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
      attachmentDrafts: createDefaultAttachmentDrafts(),
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
      attachmentDrafts: createDefaultAttachmentDrafts(),
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
          header: [
            {
              role: "user",
              content: "Header text",
              from: { source: "intent" },
            },
          ],
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
      attachmentDrafts: createDefaultAttachmentDrafts(),
    };

    expect(() => compileDraft(draft)).toThrow(DraftCompilationError);
    expect(() => compileDraft(draft)).toThrow(
      "Message block cannot have both 'content' and 'from' properties"
    );
  });
});
