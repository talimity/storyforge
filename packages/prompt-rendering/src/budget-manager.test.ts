import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "./budget-manager.js";
import type { Budget } from "./types.js";

describe("DefaultBudgetManager", () => {
  describe("token estimation", () => {
    it("should estimate tokens as ceil(chars/4)", () => {
      const budget: Budget = { maxTokens: 1000 };
      const manager = new DefaultBudgetManager(budget);

      // Test exact divisions
      expect(manager.canFitTokenEstimate("1234")).toBe(true); // 1 token
      expect(manager.canFitTokenEstimate("12345678")).toBe(true); // 2 tokens

      // Test rounding up
      expect(manager.canFitTokenEstimate("12345")).toBe(true); // ceil(5/4) = 2 tokens
      expect(manager.canFitTokenEstimate("123")).toBe(true); // ceil(3/4) = 1 token
      expect(manager.canFitTokenEstimate("1")).toBe(true); // ceil(1/4) = 1 token
    });

    it("should handle empty strings", () => {
      const budget: Budget = { maxTokens: 10 };
      const manager = new DefaultBudgetManager(budget);

      expect(manager.canFitTokenEstimate("")).toBe(true); // 0 tokens
      manager.consume("");
      expect(manager.hasAny()).toBe(true);
    });
  });

  describe("global consumption tracking", () => {
    it("should track consumed tokens correctly", () => {
      const budget: Budget = { maxTokens: 10 };
      const manager = new DefaultBudgetManager(budget);

      expect(manager.hasAny()).toBe(true);

      // Consume 4 chars = 1 token
      manager.consume("1234");
      expect(manager.hasAny()).toBe(true);

      // Consume 32 chars = 8 tokens (total 9)
      manager.consume("12345678901234567890123456789012");
      expect(manager.hasAny()).toBe(true);

      // Consume 4 more chars = 1 token (total 10)
      manager.consume("abcd");
      expect(manager.hasAny()).toBe(false);
    });

    it("should handle unlimited budget", () => {
      const budget: Budget = {}; // No maxTokens
      const manager = new DefaultBudgetManager(budget);

      expect(manager.hasAny()).toBe(true);
      expect(manager.canFitTokenEstimate("a".repeat(10000))).toBe(true);

      manager.consume("a".repeat(10000));
      expect(manager.hasAny()).toBe(true);
    });

    it("should prevent consumption beyond limits", () => {
      const budget: Budget = { maxTokens: 5 };
      const manager = new DefaultBudgetManager(budget);

      // Try to fit 24 chars = 6 tokens, should fail
      expect(manager.canFitTokenEstimate("a".repeat(24))).toBe(false);

      // Fit 20 chars = 5 tokens exactly
      expect(manager.canFitTokenEstimate("a".repeat(20))).toBe(true);
      manager.consume("a".repeat(20));
      expect(manager.hasAny()).toBe(false);

      // No more room
      expect(manager.canFitTokenEstimate("a")).toBe(false);
    });
  });

  describe("nested budgets with withNodeBudget", () => {
    it("should respect local budget limits", () => {
      const globalBudget: Budget = { maxTokens: 100 };
      const manager = new DefaultBudgetManager(globalBudget);

      const localBudget: Budget = { maxTokens: 5 };

      manager.withNodeBudget(localBudget, () => {
        // Should be limited by local budget (5 tokens)
        expect(manager.canFitTokenEstimate("a".repeat(20))).toBe(true); // 5 tokens exactly
        expect(manager.canFitTokenEstimate("a".repeat(24))).toBe(false); // 6 tokens, exceeds local

        manager.consume("a".repeat(20)); // Consume all 5 local tokens
        expect(manager.hasAny()).toBe(true); // Still has global budget
        expect(manager.canFitTokenEstimate("a")).toBe(false);
      });

      // Outside the local budget, should still have global budget available
      expect(manager.hasAny()).toBe(true);
      expect(manager.canFitTokenEstimate("a".repeat(380))).toBe(true); // 95 more tokens available
    });

    it("should respect global budget limits within local scope", () => {
      const globalBudget: Budget = { maxTokens: 10 };
      const manager = new DefaultBudgetManager(globalBudget);

      // Consume 6 tokens globally first
      manager.consume("a".repeat(24));

      const localBudget: Budget = { maxTokens: 20 }; // Larger than remaining global

      manager.withNodeBudget(localBudget, () => {
        // Should be limited by remaining global budget (4 tokens)
        expect(manager.canFitTokenEstimate("a".repeat(16))).toBe(true); // 4 tokens exactly
        expect(manager.canFitTokenEstimate("a".repeat(20))).toBe(false); // 5 tokens, exceeds global

        manager.consume("a".repeat(16)); // Consume remaining global tokens
        expect(manager.hasAny()).toBe(false);
      });

      expect(manager.hasAny()).toBe(false);
    });

    it("should handle undefined local budget", () => {
      const globalBudget: Budget = { maxTokens: 10 };
      const manager = new DefaultBudgetManager(globalBudget);

      manager.withNodeBudget(undefined, () => {
        // Should use global budget only
        expect(manager.canFitTokenEstimate("a".repeat(40))).toBe(true); // 10 tokens exactly
        expect(manager.canFitTokenEstimate("a".repeat(44))).toBe(false); // 11 tokens

        manager.consume("a".repeat(40));
        expect(manager.hasAny()).toBe(false);
      });
    });

    it("should handle local budget without maxTokens", () => {
      const globalBudget: Budget = { maxTokens: 10 };
      const manager = new DefaultBudgetManager(globalBudget);

      const localBudget: Budget = {};

      manager.withNodeBudget(localBudget, () => {
        // Should use global budget only
        expect(manager.canFitTokenEstimate("a".repeat(40))).toBe(true); // 10 tokens exactly
        manager.consume("a".repeat(40));
        expect(manager.hasAny()).toBe(false);
      });
    });

    it("should support multiple nested levels", () => {
      const globalBudget: Budget = { maxTokens: 100 };
      const manager = new DefaultBudgetManager(globalBudget);

      const level1Budget: Budget = { maxTokens: 20 };
      const level2Budget: Budget = { maxTokens: 5 };

      manager.withNodeBudget(level1Budget, () => {
        // Consume 8 tokens at level 1
        manager.consume("a".repeat(32));
        expect(manager.hasAny()).toBe(true);

        manager.withNodeBudget(level2Budget, () => {
          // Should be limited by level 2 budget (5 tokens)
          expect(manager.canFitTokenEstimate("a".repeat(20))).toBe(true); // 5 tokens exactly
          expect(manager.canFitTokenEstimate("a".repeat(24))).toBe(false); // 6 tokens

          manager.consume("a".repeat(20)); // All 5 level 2 tokens
          expect(manager.hasAny()).toBe(true); // Global budget still has tokens
        });

        // Back to level 1, should have 7 tokens remaining (20 - 8 - 5)
        expect(manager.hasAny()).toBe(true);
        expect(manager.canFitTokenEstimate("a".repeat(28))).toBe(true); // 7 tokens exactly
        expect(manager.canFitTokenEstimate("a".repeat(32))).toBe(false); // 8 tokens
      });

      // Back to global, should have 87 tokens remaining (100 - 13)
      expect(manager.hasAny()).toBe(true);
      expect(manager.canFitTokenEstimate("a".repeat(348))).toBe(true); // 87 tokens exactly
    });
  });

  describe("edge cases", () => {
    it("should handle zero maxTokens", () => {
      const budget: Budget = { maxTokens: 0 };
      const manager = new DefaultBudgetManager(budget);

      expect(manager.hasAny()).toBe(false);
      expect(manager.canFitTokenEstimate("")).toBe(false); // Can't fit anything
      expect(manager.canFitTokenEstimate("a")).toBe(false); // Any non-empty string doesn't fit
    });

    it("should handle consumption beyond limits gracefully", () => {
      const budget: Budget = { maxTokens: 5 };
      const manager = new DefaultBudgetManager(budget);

      // Force consumption beyond limit
      manager.consume("a".repeat(24)); // 6 tokens
      expect(manager.hasAny()).toBe(false);
      expect(manager.canFitTokenEstimate("a")).toBe(false);

      // Should still handle further operations
      manager.consume("more");
      expect(manager.hasAny()).toBe(false);
    });

    it("should restore methods after withNodeBudget even if thunk throws", () => {
      const globalBudget: Budget = { maxTokens: 100 };
      const manager = new DefaultBudgetManager(globalBudget);
      const localBudget: Budget = { maxTokens: 5 };

      const originalCanFit = manager.canFitTokenEstimate("a".repeat(40)); // Should be true (10 tokens < 100)

      expect(() => {
        manager.withNodeBudget(localBudget, () => {
          throw new Error("Test error");
        });
      }).toThrow("Test error");

      // Methods should be restored
      expect(manager.canFitTokenEstimate("a".repeat(40))).toBe(originalCanFit);
    });
  });
});
