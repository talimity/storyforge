import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "./budget-manager.js";
import { assembleLayout } from "./layout-assembler.js";
import { compileLeaf } from "./leaf-compiler.js";
import { makeScopedRegistry } from "./scoped-registry.js";
import type { SlotExecutionResult } from "./slot-executor.js";
import { sampleTurnGenCtx } from "./test/fixtures/test-contexts.js";
import { makeTurnGenTestRegistry } from "./test/fixtures/test-registries.js";
import type { CompiledLayoutNode, CompiledMessageBlock } from "./types.js";

describe("Layout Assembler", () => {
  const ctx = sampleTurnGenCtx;
  const registry = makeScopedRegistry(makeTurnGenTestRegistry(), { frames: [] });

  function createBudget(maxTokens = 1000): DefaultBudgetManager {
    return new DefaultBudgetManager({ maxTokens });
  }

  describe("assembleLayout", () => {
    describe("message nodes", () => {
      it("should process message node with literal content", () => {
        const budget = createBudget();
        const layout: CompiledLayoutNode[] = [
          {
            kind: "message",
            role: "user",
            content: compileLeaf("Hello {{ctx.globals.worldName}}!"),
          },
        ];
        const slotBuffers: SlotExecutionResult = {};

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          role: "user",
          content: "Hello Fantasyland!",
        });
      });

      it("should process message node with from DataRef", () => {
        const budget = createBudget();
        const layout: CompiledLayoutNode[] = [
          {
            kind: "message",
            role: "user",
            from: { source: "currentIntent" },
          },
        ];
        const slotBuffers: SlotExecutionResult = {};

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          role: "user",
          content: "Continue the conversation between Alice and Bob",
        });
      });

      it("should skip message when out of budget", () => {
        const budget = createBudget(1); // Very small budget
        const layout: CompiledLayoutNode[] = [
          {
            kind: "message",
            role: "user",
            content: compileLeaf("This is a very long message that exceeds budget"),
          },
        ];
        const slotBuffers: SlotExecutionResult = {};

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        expect(result).toHaveLength(0);
      });

      it("should skip message with null/undefined from value", () => {
        const budget = createBudget();
        const layout: CompiledLayoutNode[] = [
          {
            kind: "message",
            role: "user",
            from: { source: "nullValue" },
          },
        ];
        const slotBuffers: SlotExecutionResult = {};

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        expect(result).toHaveLength(0);
      });

      it("should retain message when template placeholders resolve to empty", () => {
        const budget = createBudget();
        const layout: CompiledLayoutNode[] = [
          {
            kind: "message",
            role: "system",
            content: compileLeaf(
              "<scenario_info>\n{{ctx.globals.missingScenario}}\n</scenario_info>"
            ),
          },
        ];
        const slotBuffers: SlotExecutionResult = {};

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          role: "system",
          content: "<scenario_info>\n\n</scenario_info>",
        });
      });

      it("should skip message when conditions are not met", () => {
        const budget = createBudget();
        const conditionalCtx = {
          ...ctx,
          globals: {
            ...ctx.globals,
            featureFlags: { showSystem: false },
          },
        };
        const layout: CompiledLayoutNode[] = [
          {
            kind: "message",
            role: "system",
            content: compileLeaf("Conditional message"),
            when: [
              { type: "exists", ref: { source: "$ctx", args: { path: "globals.featureFlags" } } },
              {
                type: "eq",
                ref: { source: "$ctx", args: { path: "globals.featureFlags.showSystem" } },
                value: true,
              },
            ],
          },
        ];
        const slotBuffers: SlotExecutionResult = {};

        const result = assembleLayout(layout, slotBuffers, conditionalCtx, budget, registry);

        expect(result).toHaveLength(0);
      });

      it("should emit message when all conditions pass", () => {
        const budget = createBudget();
        const conditionalCtx = {
          ...ctx,
          globals: {
            ...ctx.globals,
            featureFlags: { showSystem: true },
          },
        };
        const layout: CompiledLayoutNode[] = [
          {
            kind: "message",
            role: "system",
            content: compileLeaf("Conditional message"),
            when: [
              { type: "exists", ref: { source: "$ctx", args: { path: "globals.featureFlags" } } },
              {
                type: "eq",
                ref: { source: "$ctx", args: { path: "globals.featureFlags.showSystem" } },
                value: true,
              },
            ],
          },
        ];
        const slotBuffers: SlotExecutionResult = {};

        const result = assembleLayout(layout, slotBuffers, conditionalCtx, budget, registry);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ role: "system", content: "Conditional message" });
      });

      it("should stringify non-string from values", () => {
        const budget = createBudget();
        const layout: CompiledLayoutNode[] = [
          {
            kind: "message",
            role: "user",
            from: { source: "stepOutput", args: { key: "planner" } },
          },
        ];
        const slotBuffers: SlotExecutionResult = {};

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          role: "user",
          content:
            '{"plan":"Alice should ask Bob about his background","reasoning":"This will help develop character relationships"}',
        });
      });
    });

    describe("slot nodes", () => {
      it("should insert slot content without re-budget-checking", () => {
        const budget = createBudget(10); // Small budget
        const layout: CompiledLayoutNode[] = [
          {
            kind: "slot",
            name: "main",
          },
        ];
        const slotBuffers: SlotExecutionResult = {
          main: [
            {
              role: "user",
              content: "This is a very long message that would normally exceed the small budget",
            },
            {
              role: "assistant",
              content: "Another long message that would exceed budget",
            },
          ],
        };

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        // Slot content should be included despite small budget
        expect(result).toHaveLength(2);
        expect(result[0].content).toBe(
          "This is a very long message that would normally exceed the small budget"
        );
        expect(result[1].content).toBe("Another long message that would exceed budget");
      });

      it("should include headers and footers with budget checking", () => {
        const budget = createBudget();
        const header: CompiledMessageBlock = {
          role: "user",
          content: compileLeaf("Header: {{ctx.globals.worldName}}"),
        };
        const footer: CompiledMessageBlock = {
          role: "user",
          content: compileLeaf("Footer message"),
        };
        const layout: CompiledLayoutNode[] = [
          {
            kind: "slot",
            name: "main",
            header: [header],
            footer: [footer],
          },
        ];
        const slotBuffers: SlotExecutionResult = {
          main: [{ role: "assistant", content: "Slot content" }],
        };

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({
          role: "user",
          content: "Header: Fantasyland",
        });
        expect(result[1]).toEqual({
          role: "assistant",
          content: "Slot content",
        });
        expect(result[2]).toEqual({
          role: "user",
          content: "Footer message",
        });
      });

      it("should skip headers when out of budget", () => {
        const budget = createBudget(10); // Small budget
        const header: CompiledMessageBlock = {
          role: "user",
          content: compileLeaf("This is a very long header that exceeds the small budget"),
        };
        const layout: CompiledLayoutNode[] = [
          {
            kind: "slot",
            name: "main",
            header: [header],
          },
        ];
        const slotBuffers: SlotExecutionResult = {
          main: [{ role: "assistant", content: "Slot content" }],
        };

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        // Header should be skipped due to budget, but slot content included
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          role: "assistant",
          content: "Slot content",
        });
      });

      it("should handle empty slot with omitIfEmpty: true (default)", () => {
        const budget = createBudget();
        const header: CompiledMessageBlock = {
          role: "user",
          content: compileLeaf("Header"),
        };
        const layout: CompiledLayoutNode[] = [
          {
            kind: "slot",
            name: "empty",
            header: [header],
          },
        ];
        const slotBuffers: SlotExecutionResult = {
          empty: [],
        };

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        // Should be entirely skipped
        expect(result).toHaveLength(0);
      });

      it("should handle empty slot with omitIfEmpty: false", () => {
        const budget = createBudget();
        const header: CompiledMessageBlock = {
          role: "user",
          content: compileLeaf("Header"),
        };
        const footer: CompiledMessageBlock = {
          role: "user",
          content: compileLeaf("Footer"),
        };
        const layout: CompiledLayoutNode[] = [
          {
            kind: "slot",
            name: "empty",
            header: [header],
            footer: [footer],
            omitIfEmpty: false,
          },
        ];
        const slotBuffers: SlotExecutionResult = {
          empty: [],
        };

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        // Should include headers and footers even with empty slot
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          role: "user",
          content: "Header",
        });
        expect(result[1]).toEqual({
          role: "user",
          content: "Footer",
        });
      });

      it("should retain header blocks when placeholders resolve to empty", () => {
        const budget = createBudget();
        const header: CompiledMessageBlock = {
          role: "system",
          content: compileLeaf(
            "<scenario_info>\n{{ctx.globals.missingScenario}}\n</scenario_info>"
          ),
        };
        const layout: CompiledLayoutNode[] = [
          {
            kind: "slot",
            name: "main",
            header: [header],
          },
        ];
        const slotBuffers: SlotExecutionResult = {
          main: [{ role: "assistant", content: "Slot content" }],
        };

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          role: "system",
          content: "<scenario_info>\n\n</scenario_info>",
        });
        expect(result[1]).toEqual({
          role: "assistant",
          content: "Slot content",
        });
      });

      it("should throw on missing slot", () => {
        const budget = createBudget();
        const layout: CompiledLayoutNode[] = [
          {
            kind: "slot",
            name: "nonexistent",
          },
        ];
        const slotBuffers: SlotExecutionResult = {};

        expect(() => {
          assembleLayout(layout, slotBuffers, ctx, budget, registry);
        }).toThrow("Layout references nonexistent slot 'nonexistent'");
      });

      it("should handle headers with from DataRef", () => {
        const budget = createBudget();
        const header: CompiledMessageBlock = {
          role: "user",
          from: { source: "worldName" },
        };
        const layout: CompiledLayoutNode[] = [
          {
            kind: "slot",
            name: "main",
            header: [header],
          },
        ];
        const slotBuffers: SlotExecutionResult = {
          main: [{ role: "assistant", content: "Content" }],
        };

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          role: "user",
          content: "Fantasyland",
        });
      });

      it("should skip headers with null from value", () => {
        const budget = createBudget();
        const header: CompiledMessageBlock = {
          role: "user",
          from: { source: "nullValue" },
        };
        const layout: CompiledLayoutNode[] = [
          {
            kind: "slot",
            name: "main",
            header: [header],
          },
        ];
        const slotBuffers: SlotExecutionResult = {
          main: [{ role: "assistant", content: "Content" }],
        };

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        // Only slot content, header should be skipped
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          role: "assistant",
          content: "Content",
        });
      });
    });

    describe("complex layouts", () => {
      it("should process mixed layout nodes in order", () => {
        const budget = createBudget();
        const layout: CompiledLayoutNode[] = [
          {
            kind: "message",
            role: "system",
            content: compileLeaf("System message"),
          },
          {
            kind: "slot",
            name: "intro",
            header: [
              {
                role: "user",
                content: compileLeaf("Intro header"),
              },
            ],
          },
          {
            kind: "slot",
            name: "main",
          },
          {
            kind: "message",
            role: "user",
            content: compileLeaf("Final message"),
          },
        ];
        const slotBuffers: SlotExecutionResult = {
          intro: [{ role: "assistant", content: "Intro content" }],
          main: [
            { role: "user", content: "Main content 1" },
            { role: "assistant", content: "Main content 2" },
          ],
        };

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        expect(result).toHaveLength(6);
        expect(result[0]).toEqual({
          role: "system",
          content: "System message",
        });
        expect(result[1]).toEqual({ role: "user", content: "Intro header" });
        expect(result[2]).toEqual({
          role: "assistant",
          content: "Intro content",
        });
        expect(result[3]).toEqual({ role: "user", content: "Main content 1" });
        expect(result[4]).toEqual({
          role: "assistant",
          content: "Main content 2",
        });
        expect(result[5]).toEqual({ role: "user", content: "Final message" });
      });

      it("should handle budget exhaustion mid-layout", () => {
        const budget = createBudget(10); // Very limited budget
        const layout: CompiledLayoutNode[] = [
          {
            kind: "message",
            role: "user",
            content: compileLeaf("Short"), // ~1 token
          },
          {
            kind: "slot",
            name: "main",
            header: [
              {
                role: "user",
                content: compileLeaf(
                  "This is a very long header message that will definitely exceed the remaining budget and should be skipped"
                ),
              },
            ],
          },
          {
            kind: "message",
            role: "user",
            content: compileLeaf(
              "This final message should also be skipped due to budget exhaustion"
            ),
          },
        ];
        const slotBuffers: SlotExecutionResult = {
          main: [{ role: "assistant", content: "Slot content" }],
        };

        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);

        // Should include first message and slot content, but skip the header and final message
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          role: "user",
          content: "Short",
        });
        expect(result[1]).toEqual({
          role: "assistant",
          content: "Slot content",
        });
      });
    });

    describe("determinism", () => {
      it("should produce identical results for identical inputs", () => {
        const layout: CompiledLayoutNode[] = [
          {
            kind: "message",
            role: "user",
            content: compileLeaf("Hello {{ctx.globals.worldName}}"),
          },
          {
            kind: "slot",
            name: "main",
            header: [
              {
                role: "user",
                content: compileLeaf("Header"),
              },
            ],
          },
        ];
        const slotBuffers: SlotExecutionResult = {
          main: [
            { role: "assistant", content: "Response 1" },
            { role: "user", content: "Follow up" },
          ],
        };

        // Run assembly twice
        const budget1 = createBudget();
        const result1 = assembleLayout(layout, slotBuffers, ctx, budget1, registry);

        const budget2 = createBudget();
        const result2 = assembleLayout(layout, slotBuffers, ctx, budget2, registry);

        // Should be deeply equal
        expect(result1).toEqual(result2);
      });
    });

    describe("error handling", () => {
      it("should handle unknown layout node kinds gracefully", () => {
        const budget = createBudget();
        const layout = [
          {
            kind: "unknown",
            content: "Should not crash",
          },
        ] as any;
        const slotBuffers: SlotExecutionResult = {};

        // Should not throw, but should warn
        const result = assembleLayout(layout, slotBuffers, ctx, budget, registry);
        expect(result).toHaveLength(0);
      });
    });
  });
});
