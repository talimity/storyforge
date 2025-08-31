import { describe, expect, it, vi } from "vitest";
import { sampleTurnGenCtx } from "@/test/fixtures/test-contexts";
import {
  makeConditionTestRegistry,
  makeTurnGenTestRegistry,
} from "@/test/fixtures/test-registries";
import { DefaultBudgetManager } from "./budget-manager";
import { compileLeaf } from "./leaf-compiler";
import { executeSlots } from "./slot-executor";
import type { CompiledSlotSpec } from "./types";

describe("Slot Executor", () => {
  const ctx = sampleTurnGenCtx;
  const registry = makeTurnGenTestRegistry();
  const conditionRegistry = makeConditionTestRegistry();

  function createBudget(maxTokens = 1000): DefaultBudgetManager {
    return new DefaultBudgetManager({ maxTokens });
  }

  describe("executeSlots", () => {
    describe("priority ordering", () => {
      it("should execute slots in priority order (0 before 1 before 2)", () => {
        const budget = createBudget();

        const slots: Record<string, CompiledSlotSpec> = {
          slotC: {
            priority: 2,
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Priority 2 - executed third"),
              },
            ],
          },
          slotA: {
            priority: 0,
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Priority 0 - executed first"),
              },
            ],
          },
          slotB: {
            priority: 1,
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Priority 1 - executed second"),
              },
            ],
          },
        };

        const result = executeSlots(slots, ctx, budget, registry);

        // Check that all slots were executed
        expect(result.slotA).toHaveLength(1);
        expect(result.slotB).toHaveLength(1);
        expect(result.slotC).toHaveLength(1);

        // Verify content matches expected priority order
        expect(result.slotA[0].content).toContain(
          "Priority 0 - executed first"
        );
        expect(result.slotB[0].content).toContain(
          "Priority 1 - executed second"
        );
        expect(result.slotC[0].content).toContain(
          "Priority 2 - executed third"
        );
      });

      it("should handle slots with same priority consistently", () => {
        const budget = createBudget();

        const slots: Record<string, CompiledSlotSpec> = {
          slotB: {
            priority: 1,
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Slot B"),
              },
            ],
          },
          slotA: {
            priority: 1,
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Slot A"),
              },
            ],
          },
        };

        const result = executeSlots(slots, ctx, budget, registry);

        // Both slots should execute
        expect(result.slotA).toHaveLength(1);
        expect(result.slotB).toHaveLength(1);
        expect(result.slotA[0].content).toBe("Slot A");
        expect(result.slotB[0].content).toBe("Slot B");
      });
    });

    describe("conditional execution", () => {
      it("should execute slot when condition is true", () => {
        const budget = createBudget();

        const slots: Record<string, CompiledSlotSpec> = {
          conditionalSlot: {
            priority: 0,
            when: { type: "exists", ref: { source: "existsValue" } },
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Condition was true"),
              },
            ],
          },
        };

        const result = executeSlots(slots, ctx, budget, conditionRegistry);

        expect(result.conditionalSlot).toHaveLength(1);
        expect(result.conditionalSlot[0].content).toBe("Condition was true");
      });

      it("should skip slot when condition is false", () => {
        const budget = createBudget();

        const slots: Record<string, CompiledSlotSpec> = {
          skippedSlot: {
            priority: 0,
            when: { type: "exists", ref: { source: "nullValue" } },
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Should not execute"),
              },
            ],
          },
        };

        const result = executeSlots(slots, ctx, budget, conditionRegistry);

        expect(result.skippedSlot).toHaveLength(0);
      });

      it("should execute slot without condition", () => {
        const budget = createBudget();

        const slots: Record<string, CompiledSlotSpec> = {
          unconditionalSlot: {
            priority: 0,
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Always executes"),
              },
            ],
          },
        };

        const result = executeSlots(slots, ctx, budget, registry);

        expect(result.unconditionalSlot).toHaveLength(1);
        expect(result.unconditionalSlot[0].content).toBe("Always executes");
      });

      it("should handle multiple condition types", () => {
        const budget = createBudget();

        const slots: Record<string, CompiledSlotSpec> = {
          existsSlot: {
            priority: 0,
            when: { type: "exists", ref: { source: "existsValue" } },
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Exists"),
              },
            ],
          },
          nonEmptySlot: {
            priority: 1,
            when: { type: "nonEmpty", ref: { source: "nonEmptyArray" } },
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Non-empty"),
              },
            ],
          },
          equalSlot: {
            priority: 2,
            when: { type: "eq", ref: { source: "number42" }, value: 42 },
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Equals 42"),
              },
            ],
          },
        };

        const result = executeSlots(slots, ctx, budget, conditionRegistry);

        expect(result.existsSlot).toHaveLength(1);
        expect(result.nonEmptySlot).toHaveLength(1);
        expect(result.equalSlot).toHaveLength(1);
      });
    });

    describe("budget management", () => {
      it("should respect per-slot budget limits", () => {
        const budget = createBudget(1000); // Global budget

        const slots: Record<string, CompiledSlotSpec> = {
          limitedSlot: {
            priority: 0,
            budget: { maxTokens: 1 }, // Very small slot budget
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf(
                  "This message is longer than the slot budget allows"
                ),
              },
            ],
          },
          normalSlot: {
            priority: 1,
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Short"),
              },
            ],
          },
        };

        const result = executeSlots(slots, ctx, budget, registry);

        // Limited slot should have no messages due to budget constraint
        expect(result.limitedSlot).toHaveLength(0);
        // Normal slot should work fine
        expect(result.normalSlot).toHaveLength(1);
        expect(result.normalSlot[0].content).toBe("Short");
      });

      it("should isolate slot budgets from each other", () => {
        const budget = createBudget(1000);

        const slots: Record<string, CompiledSlotSpec> = {
          slot1: {
            priority: 0,
            budget: { maxTokens: 10 },
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Slot 1 message"),
              },
            ],
          },
          slot2: {
            priority: 1,
            budget: { maxTokens: 10 },
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Slot 2 message"),
              },
            ],
          },
        };

        const result = executeSlots(slots, ctx, budget, registry);

        // Both slots should succeed because they have independent budgets
        expect(result.slot1).toHaveLength(1);
        expect(result.slot2).toHaveLength(1);
        expect(result.slot1[0].content).toBe("Slot 1 message");
        expect(result.slot2[0].content).toBe("Slot 2 message");
      });

      it("should work without slot-specific budgets", () => {
        const budget = createBudget(1000);

        const slots: Record<string, CompiledSlotSpec> = {
          unboundedSlot: {
            priority: 0,
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Uses global budget only"),
              },
            ],
          },
        };

        const result = executeSlots(slots, ctx, budget, registry);

        expect(result.unboundedSlot).toHaveLength(1);
        expect(result.unboundedSlot[0].content).toBe("Uses global budget only");
      });
    });

    describe("complex plan execution", () => {
      it("should execute complex plans with multiple node types", () => {
        const budget = createBudget();

        const slots: Record<string, CompiledSlotSpec<any>> = {
          complexSlot: {
            priority: 0,
            plan: [
              {
                kind: "message",
                role: "system",
                content: compileLeaf("System message"),
              },
              {
                kind: "forEach",
                source: { source: "characters" },
                limit: 2,
                map: [
                  {
                    kind: "message",
                    role: "user",
                    content: compileLeaf("Character: {{item.name}}"),
                  },
                ],
              },
              {
                kind: "if",
                when: { type: "exists", ref: { source: "currentIntent" } },
                then: [
                  {
                    kind: "message",
                    role: "assistant",
                    content: compileLeaf("Intent exists"),
                  },
                ],
              },
            ],
          },
        };

        const result = executeSlots(slots, ctx, budget, registry);

        expect(result.complexSlot).toHaveLength(4); // 1 system + 2 forEach + 1 if
        expect(result.complexSlot[0].role).toBe("system");
        expect(result.complexSlot[0].content).toBe("System message");
        expect(result.complexSlot[1].content).toBe("Character: Alice");
        expect(result.complexSlot[2].content).toBe("Character: Bob");
        expect(result.complexSlot[3].content).toBe("Intent exists");
      });

      it("should handle empty plans", () => {
        const budget = createBudget();

        const slots: Record<string, CompiledSlotSpec> = {
          emptySlot: {
            priority: 0,
            plan: [],
          },
        };

        const result = executeSlots(slots, ctx, budget, registry);

        expect(result.emptySlot).toHaveLength(0);
      });
    });

    describe("edge cases", () => {
      it("should handle empty slots object", () => {
        const budget = createBudget();
        const slots: Record<string, CompiledSlotSpec> = {};

        const result = executeSlots(slots, ctx, budget, registry);

        expect(result).toEqual({});
      });

      it("should handle sources that throw errors gracefully", () => {
        const budget = createBudget();
        const slots: Record<string, CompiledSlotSpec<any>> = {
          errorSlot: {
            priority: 0,
            plan: [
              {
                kind: "forEach",
                source: { source: "errorThrowingSource" }, // This source will throw an error
                map: [
                  {
                    kind: "message",
                    role: "user",
                    content: compileLeaf("This should not execute"),
                  },
                ],
              },
            ],
          },
        };

        const spy = vi.spyOn(console, "warn").mockReturnValue(undefined);
        const result = executeSlots(slots, ctx, budget, registry);
        expect(spy).toHaveBeenCalledWith(
          expect.stringContaining("Unresolvable DataRef")
        );
        spy.mockRestore();

        // Expect the slot to be empty due to error in source
        expect(result.errorSlot).toHaveLength(0);
      });

      it("should handle slots with negative priorities", () => {
        const budget = createBudget();

        const slots: Record<string, CompiledSlotSpec<any>> = {
          negativePriority: {
            priority: -1,
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Negative priority"),
              },
            ],
          },
          positivePriority: {
            priority: 1,
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Positive priority"),
              },
            ],
          },
        };

        const result = executeSlots(slots, ctx, budget, registry);

        // Both should execute, negative priority should go first
        expect(result.negativePriority).toHaveLength(1);
        expect(result.positivePriority).toHaveLength(1);
      });

      it("should preserve slot names in result", () => {
        const budget = createBudget();

        const slots: Record<string, CompiledSlotSpec<any>> = {
          "custom-slot-name": {
            priority: 0,
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Custom slot"),
              },
            ],
          },
          another_slot_123: {
            priority: 1,
            plan: [
              {
                kind: "message",
                role: "user",
                content: compileLeaf("Another slot"),
              },
            ],
          },
        };

        const result = executeSlots(slots, ctx, budget, registry);

        expect(result["custom-slot-name"]).toHaveLength(1);
        expect(result.another_slot_123).toHaveLength(1);
        expect(result["custom-slot-name"][0].content).toBe("Custom slot");
        expect(result.another_slot_123[0].content).toBe("Another slot");
      });
    });

    describe("integration scenarios", () => {
      it("should demonstrate complete slot orchestration", () => {
        const budget = createBudget();

        const slots: Record<string, CompiledSlotSpec<any>> = {
          summary: {
            priority: 0,
            when: { type: "nonEmpty", ref: { source: "chapterSummaries" } },
            budget: { maxTokens: 100 },
            plan: [
              {
                kind: "message",
                role: "system",
                content: compileLeaf("Chapter summaries available"),
              },
              {
                kind: "forEach",
                source: { source: "chapterSummaries" },
                limit: 2,
                map: [
                  {
                    kind: "message",
                    role: "user",
                    content: compileLeaf(
                      "Chapter {{item.chapterNo}}: {{item.summary}}"
                    ),
                  },
                ],
              },
            ],
          },
          turns: {
            priority: 1,
            plan: [
              {
                kind: "forEach",
                source: { source: "turns" },
                limit: 2,
                map: [
                  {
                    kind: "message",
                    role: "user",
                    content: compileLeaf(
                      "{{item.authorName}}: {{item.content}}"
                    ),
                  },
                ],
              },
            ],
          },
          examples: {
            priority: 2,
            when: { type: "eq", ref: { source: "turnCount" }, value: 0 },
            plan: [
              {
                kind: "message",
                role: "assistant",
                content: compileLeaf("No turns yet, showing examples"),
              },
            ],
          },
        };

        const result = executeSlots(slots, ctx, budget, registry);

        // Summary slot should execute (chapterSummaries exist)
        expect(result.summary.length).toBeGreaterThan(0);
        expect(result.summary[0].content).toBe("Chapter summaries available");

        // Turns slot should execute
        expect(result.turns).toHaveLength(2);
        expect(result.turns[0].content).toContain("Alice:");
        expect(result.turns[1].content).toContain("Bob:");

        // Examples slot should not execute (turnCount > 0)
        expect(result.examples).toHaveLength(0);
      });
    });
  });
});
