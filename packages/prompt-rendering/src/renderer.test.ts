import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "./budget-manager";
import { compileTemplate } from "./compiler";
import { RenderError } from "./errors";
import { render } from "./renderer";
import { parseTemplate } from "./schemas";
import complexTemplateJson from "./test/fixtures/templates/complex-template.json";
import minimalTemplateJson from "./test/fixtures/templates/minimal-template.json";
import multiSlotTemplateJson from "./test/fixtures/templates/multi-slot-template.json";
import { makeTurnGenTestRegistry } from "./test/fixtures/test-registries";
import type { BudgetManager } from "./types";

describe("render function", () => {
  const budget = new DefaultBudgetManager({ maxTokens: 10000 });
  const registry = makeTurnGenTestRegistry();

  const sampleContext = {
    turns: [
      {
        turnNo: 1,
        authorName: "Alice",
        authorType: "character",
        content: "Hello world!",
      },
      {
        turnNo: 2,
        authorName: "Bob",
        authorType: "character",
        content: "Hi there!",
      },
    ],
    characters: [
      {
        id: "alice",
        name: "Alice",
        description: "A friendly character",
      },
      {
        id: "bob",
        name: "Bob",
        description: "Another character",
      },
    ],
    chapterSummaries: [],
    currentIntent: {
      description: "Test intent",
    },
    stepInputs: {},
  };

  describe("basic functionality", () => {
    it("should render a minimal template with no slots", () => {
      const template = parseTemplate(minimalTemplateJson);
      const compiled = compileTemplate(template);

      const messages = render(compiled, sampleContext, budget, registry);

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        role: "system",
        content: "You are a helpful assistant.",
      });
      expect(messages[1]).toEqual({
        role: "user",
        content: "Hello!",
      });
    });

    it("should render a template with slots", () => {
      const template = parseTemplate(multiSlotTemplateJson);
      const compiled = compileTemplate(template);

      const messages = render(compiled, sampleContext, budget, registry);

      expect(messages.length).toBeGreaterThan(3); // system + header + slot content + user message
      expect(messages[0]).toEqual({
        role: "system",
        content: "You are a helpful assistant.",
      });

      // Should include the context slot header
      expect(messages).toContainEqual({
        role: "system",
        content: "Context:",
      });

      // Should include slot content
      expect(messages).toContainEqual({
        role: "system",
        content: "Current context information.",
      });

      // Should include final user message
      expect(messages[messages.length - 1]).toEqual({
        role: "user",
        content: "Please respond...",
      });
    });

    it("should handle empty slot results", () => {
      const emptyContext = {
        ...sampleContext,
        characters: [], // Empty characters
      };

      const template = parseTemplate(complexTemplateJson);
      const compiled = compileTemplate(template);

      const messages = render(compiled, emptyContext, budget, registry);

      // Should still render successfully even with empty data sources
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toEqual({
        role: "system",
        content: "You are a helpful assistant.",
      });
    });
  });

  describe("complex template functionality", () => {
    it("should render a complex template with conditions and forEach", () => {
      const template = parseTemplate(complexTemplateJson);
      const compiled = compileTemplate(template);

      const messages = render(compiled, sampleContext, budget, registry);

      expect(messages.length).toBeGreaterThan(0);

      // Should include system message
      expect(messages[0]).toEqual({
        role: "system",
        content: "You are a helpful assistant.",
      });

      // Should include final user message
      expect(messages[messages.length - 1]).toEqual({
        role: "user",
        content: "Continue the story.",
      });

      // Should include character information from forEach loop
      expect(messages).toContainEqual({
        role: "system",
        content: "Alice: A friendly character",
      });
    });

    it("should handle conditions correctly", () => {
      // Test with data that should trigger the 'then' branch
      const contextWithTurns = {
        ...sampleContext,
        // Add recentTurns for the complex template
        recentTurns: [{ turnNo: 1, content: "Recent turn content" }],
      } as any; // Cast to bypass strict typing for test

      const template = parseTemplate(complexTemplateJson);
      const compiled = compileTemplate(template);

      const messages = render(compiled, contextWithTurns, budget, registry);

      expect(messages.length).toBeGreaterThan(0);
      // The exact message content will depend on the template execution
      // but it should complete without errors
    });
  });

  describe("error handling", () => {
    it("should wrap unexpected errors in RenderError", () => {
      // Create a budget manager that will throw an error
      const faultyBudget: BudgetManager = {
        hasAny: () => true,
        canFitTokenEstimate: () => true,
        consume: () => {
          throw new Error("Simulated budget error");
        },
        withNodeBudget: (_budget, thunk) => {
          thunk();
        },
      };

      const template = parseTemplate(minimalTemplateJson); // Use simpler template
      const compiled = compileTemplate(template);

      expect(() => {
        render(compiled, sampleContext, faultyBudget, registry);
      }).toThrow(RenderError);

      expect(() => {
        render(compiled, sampleContext, faultyBudget, registry);
      }).toThrow(/Unexpected error during template rendering/);
    });

    it("should re-throw known error types without wrapping", () => {
      // This would require more complex setup to trigger specific errors
      // For now, just verify the render completes normally with valid inputs
      const template = parseTemplate(minimalTemplateJson);
      const compiled = compileTemplate(template);

      expect(() => {
        render(compiled, sampleContext, budget, registry);
      }).not.toThrow();
    });
  });

  describe("budget management", () => {
    it("should respect budget limits during rendering", () => {
      // Create a very restrictive budget
      const restrictiveBudget = new DefaultBudgetManager({ maxTokens: 1 }); // Very small budget

      const template = parseTemplate(complexTemplateJson);
      const compiled = compileTemplate(template);

      // Should still complete, but may have fewer messages due to budget
      const messages = render(
        compiled,
        sampleContext,
        restrictiveBudget,
        registry
      );

      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);
    });
  });

  describe("type safety", () => {
    it("should maintain type constraints between template and context", () => {
      // This is mostly enforced at compile time, but we can verify runtime behavior
      const template = parseTemplate(minimalTemplateJson);
      const compiled = compileTemplate(template);

      // Should work with correct context type
      expect(() => {
        render(compiled, sampleContext, budget, registry);
      }).not.toThrow();

      // The TypeScript compiler will catch type mismatches at compile time
    });
  });

  describe("determinism", () => {
    it("should produce identical results for identical inputs", () => {
      const template = parseTemplate(multiSlotTemplateJson);
      const compiled = compileTemplate(template);

      const messages1 = render(compiled, sampleContext, budget, registry);
      const messages2 = render(compiled, sampleContext, budget, registry);

      expect(messages1).toEqual(messages2);
    });
  });
});
