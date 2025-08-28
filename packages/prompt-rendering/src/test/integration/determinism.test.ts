import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "../../budget-manager";
import { compileTemplate } from "../../compiler";
import { render } from "../../renderer";
import { parseTemplate } from "../../schemas";
import {
  deterministicTurnGenCtx,
  standardTurnGenCtx,
} from "../fixtures/contexts/turn-generation-contexts";
import { makeSpecTurnGenerationRegistry } from "../fixtures/registries/turn-generation-registry";
import turnPlannerV1Json from "../fixtures/templates/spec/tpl_turn_planner_v1.json";
import turnWriterV2Json from "../fixtures/templates/spec/tpl_turn_writer_v2.json";

describe("Determinism & Immutability", () => {
  const registry = makeSpecTurnGenerationRegistry();

  it("should produce identical output with identical inputs", () => {
    const template = parseTemplate(turnWriterV2Json);
    const compiled = compileTemplate(template);

    // Create separate budget managers with identical settings
    const budget1 = new DefaultBudgetManager({ maxTokens: 2000 });
    const budget2 = new DefaultBudgetManager({ maxTokens: 2000 });
    const budget3 = new DefaultBudgetManager({ maxTokens: 2000 });

    // Render multiple times
    const result1 = render(
      compiled,
      deterministicTurnGenCtx,
      budget1,
      registry
    );
    const result2 = render(
      compiled,
      deterministicTurnGenCtx,
      budget2,
      registry
    );
    const result3 = render(
      compiled,
      deterministicTurnGenCtx,
      budget3,
      registry
    );

    // All results should be deeply equal
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
    expect(result1).toEqual(result3);

    // Should be exact same structure and content
    expect(result1.length).toBe(result2.length);
    expect(result1.length).toBe(result3.length);

    for (let i = 0; i < result1.length; i++) {
      expect(result1[i]).toMatchObject(result2[i]);
      expect(result1[i]).toMatchObject(result3[i]);
    }
  });

  it("should maintain determinism across different template types", () => {
    // Test both writer and planner templates for determinism
    const writerTemplate = parseTemplate(turnWriterV2Json);
    const plannerTemplate = parseTemplate(turnPlannerV1Json);

    const compiledWriter = compileTemplate(writerTemplate);
    const compiledPlanner = compileTemplate(plannerTemplate);

    // Multiple renders of each
    const writerResults = Array.from({ length: 3 }, () => {
      const budget = new DefaultBudgetManager({ maxTokens: 3000 });
      return render(compiledWriter, deterministicTurnGenCtx, budget, registry);
    });

    const plannerResults = Array.from({ length: 3 }, () => {
      const budget = new DefaultBudgetManager({ maxTokens: 3000 });
      return render(compiledPlanner, deterministicTurnGenCtx, budget, registry);
    });

    // Each template type should be internally consistent
    expect(writerResults[0]).toEqual(writerResults[1]);
    expect(writerResults[1]).toEqual(writerResults[2]);

    expect(plannerResults[0]).toEqual(plannerResults[1]);
    expect(plannerResults[1]).toEqual(plannerResults[2]);
  });

  it("should be deterministic with complex slot interactions", () => {
    // Use context that triggers all slots with various conditions
    const template = parseTemplate(turnWriterV2Json);
    const compiled = compileTemplate(template);

    const complexContext = {
      turns: [], // Triggers examples slot
      chapterSummaries: deterministicTurnGenCtx.chapterSummaries,
      characters: deterministicTurnGenCtx.characters,
      currentIntent: deterministicTurnGenCtx.currentIntent,
      stepInputs: deterministicTurnGenCtx.stepInputs,
      globals: deterministicTurnGenCtx.globals,
    };

    // Multiple renders with slot interactions
    const results = Array.from({ length: 5 }, () => {
      const budget = new DefaultBudgetManager({ maxTokens: 4000 });
      return render(compiled, complexContext, budget, registry);
    });

    // All should be identical
    for (let i = 1; i < results.length; i++) {
      expect(results[0]).toEqual(results[i]);
    }
  });

  it("should have immutable compiled templates", () => {
    const template = parseTemplate(turnWriterV2Json);
    const compiled = compileTemplate(template);

    // Store original values
    const originalId = compiled.id;
    const originalName = compiled.name;
    const originalLayoutLength = compiled.layout.length;
    const originalSlotsKeys = Object.keys(compiled.slots);

    // Attempt to modify top-level properties
    expect(() => {
      (compiled as any).id = "modified";
    }).toThrow(); // Should throw because it's frozen

    expect(() => {
      (compiled as any).name = "modified";
    }).toThrow();

    expect(() => {
      (compiled as any).newProperty = "should not work";
    }).toThrow();

    // Verify values unchanged
    expect(compiled.id).toBe(originalId);
    expect(compiled.name).toBe(originalName);

    // Attempt to modify layout array
    expect(() => {
      (compiled.layout as any).push({
        kind: "message",
        role: "user",
        content: "hacked",
      });
    }).toThrow();

    expect(() => {
      (compiled.layout as any)[0] = { kind: "separator" };
    }).toThrow();

    // Verify layout unchanged
    expect(compiled.layout.length).toBe(originalLayoutLength);

    // Attempt to modify slots
    expect(() => {
      (compiled.slots as any).newSlot = { priority: 99, plan: [] };
    }).toThrow();

    expect(() => {
      delete (compiled.slots as any).turns;
    }).toThrow();

    // Verify slots unchanged
    expect(Object.keys(compiled.slots)).toEqual(originalSlotsKeys);
  });

  it("should have deep immutability in nested structures", () => {
    const template = parseTemplate(turnWriterV2Json);
    const compiled = compileTemplate(template);

    // Try to modify nested layout node properties
    const firstLayoutNode = compiled.layout[0];
    expect(() => {
      (firstLayoutNode as any).role = "assistant";
    }).toThrow();

    // Try to modify slot plan
    const turnsSlot = compiled.slots.turns;
    expect(() => {
      (turnsSlot as any).priority = 999;
    }).toThrow();

    expect(() => {
      (turnsSlot.plan as any).push({
        kind: "message",
        role: "user",
        content: "hack",
      });
    }).toThrow();

    // Try to modify nested plan nodes
    const firstPlanNode = turnsSlot.plan[0];
    expect(() => {
      (firstPlanNode as any).kind = "if";
    }).toThrow();
  });

  it("should not have side effects between renders", () => {
    const template = parseTemplate(turnWriterV2Json);
    const compiled = compileTemplate(template);

    // Create contexts with different turn counts to ensure different output
    const ctx1 = {
      ...deterministicTurnGenCtx,
      turns: [deterministicTurnGenCtx.turns[0]], // Only 1 turn
    };

    const ctx2 = {
      ...deterministicTurnGenCtx,
      turns: deterministicTurnGenCtx.turns, // All turns
    };

    // Render with first context
    const budget1 = new DefaultBudgetManager({ maxTokens: 2000 });
    const result1 = render(compiled, ctx1, budget1, registry);

    // Render with second context
    const budget2 = new DefaultBudgetManager({ maxTokens: 2000 });
    const result2 = render(compiled, ctx2, budget2, registry);

    // Render first context again
    const budget3 = new DefaultBudgetManager({ maxTokens: 2000 });
    const result3 = render(compiled, ctx1, budget3, registry);

    // First and third renders should be identical (no side effects from second)
    expect(result1).toEqual(result3);

    // Second render should be different (more turns = more messages)
    expect(result1.length).not.toBe(result2.length);
  });

  it("should maintain determinism with budget constraints", () => {
    const template = parseTemplate(turnWriterV2Json);
    const compiled = compileTemplate(template);

    // Test with the same budget constraint multiple times
    const budgetLimit = 800;
    const results = Array.from({ length: 4 }, () => {
      const budget = new DefaultBudgetManager({ maxTokens: budgetLimit });
      return render(compiled, standardTurnGenCtx, budget, registry);
    });

    // All constrained results should be identical
    for (let i = 1; i < results.length; i++) {
      expect(results[0]).toEqual(results[i]);
    }

    // Snapshot the deterministic budget-constrained output
    expect(results[0]).toMatchSnapshot("deterministic-budget-constrained");
  });

  it("should handle concurrent rendering safely", () => {
    // Simulate concurrent rendering (though JS is single-threaded, this tests for shared state issues)
    const template = parseTemplate(turnWriterV2Json);
    const compiled = compileTemplate(template);

    const contexts = [
      deterministicTurnGenCtx,
      {
        ...deterministicTurnGenCtx,
        currentIntent: { description: "Variant 1" },
      },
      {
        ...deterministicTurnGenCtx,
        currentIntent: { description: "Variant 2" },
      },
    ];

    // Render all contexts "simultaneously"
    const results = contexts.map((ctx) => {
      const budget = new DefaultBudgetManager({ maxTokens: 2000 });
      return render(compiled, ctx, budget, registry);
    });

    // Re-render same contexts to verify no interference
    const results2 = contexts.map((ctx) => {
      const budget = new DefaultBudgetManager({ maxTokens: 2000 });
      return render(compiled, ctx, budget, registry);
    });

    // Each position should be identical between runs
    expect(results[0]).toEqual(results2[0]);
    expect(results[1]).toEqual(results2[1]);
    expect(results[2]).toEqual(results2[2]);
  });

  it("should preserve determinism after template compilation", () => {
    // Compile the same template multiple times
    const template = parseTemplate(turnWriterV2Json);

    const compiled1 = compileTemplate(template);
    const compiled2 = compileTemplate(template);
    const compiled3 = compileTemplate(template);

    // All compilations should produce equivalent results
    const budget1 = new DefaultBudgetManager({ maxTokens: 2000 });
    const budget2 = new DefaultBudgetManager({ maxTokens: 2000 });
    const budget3 = new DefaultBudgetManager({ maxTokens: 2000 });

    const result1 = render(
      compiled1,
      deterministicTurnGenCtx,
      budget1,
      registry
    );
    const result2 = render(
      compiled2,
      deterministicTurnGenCtx,
      budget2,
      registry
    );
    const result3 = render(
      compiled3,
      deterministicTurnGenCtx,
      budget3,
      registry
    );

    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });
});
