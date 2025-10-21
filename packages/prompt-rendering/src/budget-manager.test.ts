import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "./budget-manager.js";

const charEstimator = (text: string) => text.length;

describe("DefaultBudgetManager", () => {
  it("estimates tokens via expose method", () => {
    const manager = new DefaultBudgetManager({ maxTokens: 10 }, charEstimator);
    expect(manager.estimateTokens("abcd")).toBe(4);
    expect(manager.estimateTokens("abcdefgh")).toBe(8);
  });

  it("reserves floor for lanes and protects remaining budget", () => {
    const manager = new DefaultBudgetManager({ maxTokens: 10 }, charEstimator);
    manager.reserveFloor("layout", 4);

    expect(manager.canFitTokenEstimate("a".repeat(10))).toBe(false);
    expect(manager.canFitTokenEstimate("a".repeat(6))).toBe(true);
    manager.consume("a".repeat(6));

    expect(manager.hasAny()).toBe(false);
    expect(manager.canFitTokenEstimate("a".repeat(4))).toBe(false); // cannot use reserved floor
  });

  it("allows lane work to consume its reserved floor", () => {
    const manager = new DefaultBudgetManager({ maxTokens: 10 }, charEstimator);
    manager.reserveFloor("layout", 6);

    let emitted = false;
    manager.withLane("layout", () => {
      emitted = manager.canFitTokenEstimate("a".repeat(6));
      if (emitted) {
        manager.consume("a".repeat(6));
      }
    });

    expect(emitted).toBe(true);
    expect(manager.hasAny()).toBe(true);
  });

  it("releases floor when no longer needed", () => {
    const manager = new DefaultBudgetManager({ maxTokens: 10 }, charEstimator);
    manager.reserveFloor("layout", 6);
    manager.releaseFloor("layout", 6);
    expect(manager.canFitTokenEstimate("a".repeat(10))).toBe(true);
  });

  it("keeps lane reservations isolated", () => {
    const manager = new DefaultBudgetManager({ maxTokens: 200 }, charEstimator);
    manager.reserveFloor("laneA", 100);
    manager.reserveFloor("laneB", 80);

    manager.withLane("laneA", () => {
      expect(manager.canFitTokenEstimate("x".repeat(70))).toBe(true);
      manager.consume("x".repeat(70));
    });

    manager.withLane("laneB", () => {
      expect(manager.canFitTokenEstimate("y".repeat(111))).toBe(false);
      expect(manager.canFitTokenEstimate("y".repeat(80))).toBe(true);
      manager.consume("y".repeat(80));
    });

    expect(manager.canFitTokenEstimate("z".repeat(30))).toBe(false);
  });
});
