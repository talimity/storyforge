import { describe, expect, it, vi } from "vitest";
import { DefaultBudgetManager } from "./budget-manager.js";
import { compileLeaf } from "./leaf-compiler.js";
import {
  createScope,
  executeForEachNode,
  executeIfNode,
  executeMessageNode,
  executePlanNode,
  executePlanNodes,
} from "./plan-executor.js";
import { sampleTurnGenCtx } from "./test/fixtures/test-contexts.js";
import {
  makeConditionTestRegistry,
  makeOrderingTestRegistry,
  makeTurnGenTestRegistry,
} from "./test/fixtures/test-registries.js";
import type { Budget, CompiledPlanNode } from "./types.js";

describe("Plan Executor", () => {
  const ctx = sampleTurnGenCtx;
  const registry = makeTurnGenTestRegistry();

  function createBudget(maxTokens = 1000): DefaultBudgetManager {
    return new DefaultBudgetManager({ maxTokens });
  }

  describe("createScope", () => {
    it("should merge ctx, item, and globals", () => {
      const item = { name: "Alice", value: 42 };
      const scope = createScope(ctx, item);

      expect(scope.ctx).toBe(ctx);
      expect(scope.item).toBe(item);
      expect(scope.globals).toBe(ctx.globals);
    });

    it("should work without item", () => {
      const scope = createScope(ctx);

      expect(scope.ctx).toBe(ctx);
      expect(scope.item).toBeUndefined();
      expect(scope.globals).toBe(ctx.globals);
    });
  });

  describe("executeMessageNode", () => {
    describe("content resolution", () => {
      it("should use 'from' DataRef when present", () => {
        const budget = createBudget();
        const node: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "user",
          from: { source: "currentIntent" },
        };

        const result = executeMessageNode(node, ctx, budget, registry);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          role: "user",
          content: "Continue the conversation between Alice and Bob",
        });
      });

      it("should use literal 'content' when 'from' is not present", () => {
        const budget = createBudget();
        const compiledContent = compileLeaf("Hello {{item.name}}!");
        const node: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "assistant",
          content: compiledContent,
        };
        const item = { name: "World" };

        const result = executeMessageNode(node, ctx, budget, registry, item);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          role: "assistant",
          content: "Hello World!",
        });
      });

      it("should prefer 'from' over 'content' when both are present", () => {
        const budget = createBudget();
        const compiledContent = compileLeaf("This should not appear");
        const node: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "user",
          from: { source: "worldName" },
          content: compiledContent,
        };

        const result = executeMessageNode(node, ctx, budget, registry);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          role: "user",
          content: "Fantasyland",
        });
      });

      it("should handle missing DataRef sources gracefully", () => {
        const budget = createBudget();
        const node: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "user",
          from: { source: "nonexistentSource" },
        };

        const result = executeMessageNode(node, ctx, budget, registry);

        // Should skip empty messages
        expect(result).toHaveLength(0);
      });

      it("should stringify non-string from values as JSON", () => {
        const budget = createBudget();
        const node: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "user",
          from: { source: "stepOutput", args: { key: "planner" } },
        };

        const result = executeMessageNode(node, ctx, budget, registry);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          role: "user",
          content:
            '{"plan":"Alice should ask Bob about his background","reasoning":"This will help develop character relationships"}',
        });
      });

      it("should handle null/undefined from values by skipping emission", () => {
        const budget = createBudget();
        const nullNode: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "user",
          from: { source: "nullValue" },
        };
        const undefinedNode: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "user",
          from: { source: "undefinedValue" },
        };

        const nullResult = executeMessageNode(nullNode, ctx, budget, registry);
        const undefinedResult = executeMessageNode(undefinedNode, ctx, budget, registry);

        expect(nullResult).toHaveLength(0);
        expect(undefinedResult).toHaveLength(0);
      });

      it("should skip message when template placeholders resolve to empty", () => {
        const budget = createBudget();
        const node: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "system",
          content: compileLeaf(
            "<scenario_info>\n{{ctx.globals.missingScenario}}\n</scenario_info>"
          ),
          skipIfEmptyInterpolation: true,
        };

        const result = executeMessageNode(node, ctx, budget, registry);

        expect(result).toHaveLength(0);
      });

      it("should retain message when skipIfEmptyInterpolation not enabled", () => {
        const budget = createBudget();
        const node: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "system",
          content: compileLeaf(
            "<scenario_info>\n{{ctx.globals.missingScenario}}\n</scenario_info>"
          ),
        };

        const result = executeMessageNode(node, ctx, budget, registry);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          role: "system",
          content: "<scenario_info>\n\n</scenario_info>",
        });
      });
    });

    describe("prefix flag", () => {
      it("should preserve prefix flag when true", () => {
        const budget = createBudget();
        const node: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "assistant",
          content: compileLeaf("Test message"),
          prefix: true,
        };

        const result = executeMessageNode(node, ctx, budget, registry);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          role: "assistant",
          content: "Test message",
          prefix: true,
        });
      });

      it("should not include prefix when false or undefined", () => {
        const budget = createBudget();
        const node: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "user",
          content: compileLeaf("Test message"),
        };

        const result = executeMessageNode(node, ctx, budget, registry);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          role: "user",
          content: "Test message",
        });
        expect(result[0].prefix).toBeUndefined();
      });
    });

    describe("budget handling", () => {
      it("should consume budget for message content", () => {
        const budget = createBudget(100);
        const node: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "user",
          content: compileLeaf("Test message"),
        };

        executeMessageNode(node, ctx, budget, registry);

        // Should have consumed tokens (estimated as text.length / 4)
        expect(budget.hasAny()).toBe(true);
      });

      it("should skip message if no global budget", () => {
        const budget = createBudget(0); // No budget
        const node: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "user",
          content: compileLeaf("Test message"),
        };

        const result = executeMessageNode(node, ctx, budget, registry);

        expect(result).toHaveLength(0);
      });

      it("should respect node-level budget", () => {
        const budget = createBudget(100);
        const nodeBudget: Budget = { maxTokens: 1 }; // Very small budget
        const node: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "user",
          content: compileLeaf("This is a very long message that should exceed the node budget"),
          budget: nodeBudget,
        };

        const result = executeMessageNode(node, ctx, budget, registry);

        expect(result).toHaveLength(0); // Should be skipped due to budget
      });

      it("should skip empty messages", () => {
        const budget = createBudget();
        const node: CompiledPlanNode<any> & { kind: "message" } = {
          kind: "message",
          role: "user",
          content: compileLeaf(""),
        };

        const result = executeMessageNode(node, ctx, budget, registry);

        expect(result).toHaveLength(0);
      });
    });
  });

  describe("executeForEachNode", () => {
    const orderingRegistry = makeOrderingTestRegistry();

    describe("basic iteration", () => {
      it("should iterate over array and execute child nodes", () => {
        const budget = createBudget();
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("Turn {{item.turnNo}}: {{item.content}}"),
        };
        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "turns" },
          map: [childNode],
        };

        const result = executeForEachNode(node, ctx, budget, registry);

        expect(result).toHaveLength(3);
        expect(result[0].content).toBe("Turn 1: Hello there! How are you doing today?");
        expect(result[1].content).toBe(
          "Turn 2: I'm doing well, thanks for asking. What brings you here?"
        );
        expect(result[2].content).toBe("Turn 3: The wind picks up as the conversation continues.");
      });

      it("should handle empty arrays", () => {
        const budget = createBudget();
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("Should not appear"),
        };
        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "emptyArray" },
          map: [childNode],
        };

        const result = executeForEachNode(node, ctx, budget, registry);

        expect(result).toHaveLength(0);
      });

      it("should handle non-array sources gracefully", () => {
        const budget = createBudget();
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("Should not appear"),
        };
        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "currentIntent" }, // Returns string, not array
          map: [childNode],
        };

        const result = executeForEachNode(node, ctx, budget, registry);

        expect(result).toHaveLength(0);
      });
    });

    describe("ordering", () => {
      it("should maintain original order when no order specified", () => {
        const budget = createBudget();
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("{{item}}"),
        };
        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "numbers" },
          map: [childNode],
        };

        const result = executeForEachNode(node, ctx, budget, orderingRegistry);

        expect(result[0].content).toBe("3"); // First item in original array
        expect(result[1].content).toBe("1");
        expect(result[2].content).toBe("4");
      });

      it("should sort ascending with 'asc' order", () => {
        const budget = createBudget();
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("{{item}}"),
        };
        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "strings" },
          order: "asc",
          map: [childNode],
        };

        const result = executeForEachNode(node, ctx, budget, orderingRegistry);

        expect(result[0].content).toBe("alice");
        expect(result[1].content).toBe("bob");
        expect(result[2].content).toBe("charlie");
        expect(result[3].content).toBe("david");
      });

      it("should sort descending with 'desc' order", () => {
        const budget = createBudget();
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("{{item}}"),
        };
        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "strings" },
          order: "desc",
          map: [childNode],
        };

        const result = executeForEachNode(node, ctx, budget, orderingRegistry);

        expect(result[0].content).toBe("david");
        expect(result[1].content).toBe("charlie");
        expect(result[2].content).toBe("bob");
        expect(result[3].content).toBe("alice");
      });
    });

    describe("limit", () => {
      it("should respect limit parameter", () => {
        const budget = createBudget();
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("Character {{item.name}}"),
        };
        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "characters" },
          limit: 2,
          map: [childNode],
        };

        const result = executeForEachNode(node, ctx, budget, registry);

        expect(result).toHaveLength(2);
        expect(result[0].content).toBe("Character Alice");
        expect(result[1].content).toBe("Character Bob");
      });

      it("should handle limit larger than array size", () => {
        const budget = createBudget();
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("{{item}}"),
        };
        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "singleItem" },
          limit: 10,
          map: [childNode],
        };

        const result = executeForEachNode(node, ctx, budget, orderingRegistry);

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe("only");
      });
    });

    describe("interleave separators", () => {
      it("should add separators between items", () => {
        const budget = createBudget();
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "assistant",
          content: compileLeaf("{{item}}"),
        };
        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "singleItem" },
          map: [childNode],
          interleave: { kind: "separator", text: compileLeaf("---") },
        };

        // Use an array with multiple items for this test
        const multiItemRegistry = makeOrderingTestRegistry();
        const result = executeForEachNode(
          {
            ...node,
            source: { source: "strings" },
            limit: 3,
          },
          ctx,
          budget,
          multiItemRegistry
        );

        expect(result).toHaveLength(5); // 3 items + 2 separators
        expect(result[0].role).toBe("assistant");
        expect(result[1].role).toBe("user"); // Separator
        expect(result[1].content).toBe("---");
        expect(result[2].role).toBe("assistant");
        expect(result[3].role).toBe("user"); // Separator
        expect(result[4].role).toBe("assistant");
      });

      it("should not add separator after last item", () => {
        const budget = createBudget();
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "assistant",
          content: compileLeaf("{{item}}"),
        };
        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "singleItem" },
          map: [childNode],
          interleave: { kind: "separator", text: compileLeaf("---") },
        };

        const result = executeForEachNode(node, ctx, budget, orderingRegistry);

        expect(result).toHaveLength(1); // Only the single item, no separator
        expect(result[0].role).toBe("assistant");
        expect(result[0].content).toBe("only");
      });
    });

    describe("budget handling", () => {
      it("should stop early when out of budget and stopWhenOutOfBudget is true", () => {
        const budget = createBudget(5); // Very small budget
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("This is a long message that will consume budget"),
        };
        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "characters" },
          map: [childNode],
          stopWhenOutOfBudget: true,
        };

        const result = executeForEachNode(node, ctx, budget, registry);

        // Should have fewer results than the full character array
        expect(result.length).toBeLessThan(ctx.characters.length);
      });

      it("should continue when stopWhenOutOfBudget is false", () => {
        const budget = createBudget(100); // Reasonable budget

        // Create a child node that logs execution but may produce empty messages
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("{{item.name}}"),
        };

        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "characters" },
          map: [childNode], // Only use the main child node
          stopWhenOutOfBudget: false,
        };

        const result = executeForEachNode(node, ctx, budget, registry);

        // Should process all 3 characters since we have adequate budget and stopWhenOutOfBudget is false
        expect(result.length).toBe(ctx.characters.length);
        expect(result[0].content).toBe("Alice");
        expect(result[1].content).toBe("Bob");
        expect(result[2].content).toBe("Charlie");
      });

      it("should default stopWhenOutOfBudget to true", () => {
        const budget = createBudget(5); // Very small budget
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("This is a long message that will consume budget"),
        };
        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "characters" },
          map: [childNode],
          // stopWhenOutOfBudget not specified, should default to true
        };

        const result = executeForEachNode(node, ctx, budget, registry);

        // Should have fewer results due to budget stopping
        expect(result.length).toBeLessThan(ctx.characters.length);
      });

      it("should respect node budget ceiling for entire forEach loop", () => {
        const budget = createBudget(1000); // Global budget
        const childNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("Short message"), // Each message ~3 tokens
        };
        const node: CompiledPlanNode<any> & { kind: "forEach" } = {
          kind: "forEach",
          source: { source: "characters" }, // 3 characters
          map: [childNode],
          budget: { maxTokens: 6 }, // Should allow ~2 messages total
        };

        const result = executeForEachNode(node, ctx, budget, registry);

        // Should have fewer than 3 results due to node budget constraint
        expect(result.length).toBeLessThan(ctx.characters.length);
        expect(result.length).toBeGreaterThan(0); // But should have some results
        expect(result.length).toBeLessThanOrEqual(2); // Should cap around budget limit
      });
    });
  });

  describe("executeIfNode", () => {
    const conditionRegistry = makeConditionTestRegistry();

    describe("condition evaluation", () => {
      it("should execute 'then' branch when condition is true", () => {
        const budget = createBudget();
        const thenNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("Condition was true"),
        };
        const elseNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("Condition was false"),
        };
        const node: CompiledPlanNode<any> & { kind: "if" } = {
          kind: "if",
          when: { type: "exists", ref: { source: "existsValue" } },
          then: [thenNode],
          else: [elseNode],
        };

        const result = executeIfNode(node, ctx, budget, conditionRegistry);

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe("Condition was true");
      });

      it("should execute 'else' branch when condition is false", () => {
        const budget = createBudget();
        const thenNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("Condition was true"),
        };
        const elseNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("Condition was false"),
        };
        const node: CompiledPlanNode<any> & { kind: "if" } = {
          kind: "if",
          when: { type: "exists", ref: { source: "nullValue" } },
          then: [thenNode],
          else: [elseNode],
        };

        const result = executeIfNode(node, ctx, budget, conditionRegistry);

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe("Condition was false");
      });

      it("should return empty array when condition is false and no else branch", () => {
        const budget = createBudget();
        const thenNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("Condition was true"),
        };
        const node: CompiledPlanNode<any> & { kind: "if" } = {
          kind: "if",
          when: { type: "exists", ref: { source: "nullValue" } },
          then: [thenNode],
        };

        const result = executeIfNode(node, ctx, budget, conditionRegistry);

        expect(result).toHaveLength(0);
      });

      it("should handle all condition types", () => {
        const budget = createBudget();
        const thenNode: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("Success"),
        };

        // Test various condition types
        const conditions = [
          {
            type: "exists" as const,
            ref: { source: "existsValue" },
            expected: true,
          },
          {
            type: "exists" as const,
            ref: { source: "nullValue" },
            expected: false,
          },
          {
            type: "nonEmpty" as const,
            ref: { source: "nonEmptyArray" },
            expected: true,
          },
          {
            type: "nonEmpty" as const,
            ref: { source: "emptyArray" },
            expected: false,
          },
          {
            type: "eq" as const,
            ref: { source: "number42" },
            value: 42,
            expected: true,
          },
          {
            type: "eq" as const,
            ref: { source: "number42" },
            value: 43,
            expected: false,
          },
          {
            type: "neq" as const,
            ref: { source: "number42" },
            value: 43,
            expected: true,
          },
          {
            type: "gt" as const,
            ref: { source: "number42" },
            value: 41,
            expected: true,
          },
          {
            type: "lt" as const,
            ref: { source: "number42" },
            value: 43,
            expected: true,
          },
        ];

        for (const condition of conditions) {
          const node: CompiledPlanNode<any> & { kind: "if" } = {
            kind: "if",
            when: condition,
            then: [thenNode],
          };

          const result = executeIfNode(node, ctx, budget, conditionRegistry);

          if (condition.expected) {
            expect(result).toHaveLength(1);
            expect(result[0].content).toBe("Success");
          } else {
            expect(result).toHaveLength(0);
          }
        }
      });
    });

    describe("nested execution", () => {
      it("should execute multiple nodes in then branch", () => {
        const budget = createBudget();
        const node1: CompiledPlanNode<any> = {
          kind: "message",
          role: "user",
          content: compileLeaf("First message"),
        };
        const node2: CompiledPlanNode<any> = {
          kind: "message",
          role: "assistant",
          content: compileLeaf("Second message"),
        };
        const ifNode: CompiledPlanNode<any> & { kind: "if" } = {
          kind: "if",
          when: { type: "exists", ref: { source: "existsValue" } },
          then: [node1, node2],
        };

        const result = executeIfNode(ifNode, ctx, budget, conditionRegistry);

        expect(result).toHaveLength(2);
        expect(result[0].content).toBe("First message");
        expect(result[0].role).toBe("user");
        expect(result[1].content).toBe("Second message");
        expect(result[1].role).toBe("assistant");
      });
    });
  });

  describe("executePlanNode - dispatcher", () => {
    it("should dispatch message nodes correctly", () => {
      const budget = createBudget();
      const node: CompiledPlanNode<any> = {
        kind: "message",
        role: "user",
        content: compileLeaf("Test message"),
      };

      const result = executePlanNode(node, ctx, budget, registry);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Test message");
    });

    it("should dispatch forEach nodes correctly", () => {
      const budget = createBudget();
      const childNode: CompiledPlanNode<any> = {
        kind: "message",
        role: "user",
        content: compileLeaf("Item: {{item.name}}"),
      };
      const node: CompiledPlanNode<any> = {
        kind: "forEach",
        source: { source: "characters" },
        limit: 1,
        map: [childNode],
      };

      const result = executePlanNode(node, ctx, budget, registry);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Item: Alice");
    });

    it("should dispatch if nodes correctly", () => {
      const budget = createBudget();
      const thenNode: CompiledPlanNode<any> = {
        kind: "message",
        role: "user",
        content: compileLeaf("True branch"),
      };
      const node: CompiledPlanNode<any> = {
        kind: "if",
        when: { type: "exists", ref: { source: "currentIntent" } },
        then: [thenNode],
      };

      const result = executePlanNode(node, ctx, budget, registry);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("True branch");
    });

    it("should handle unknown node kinds gracefully", () => {
      const budget = createBudget();
      const node = {
        kind: "unknown",
        role: "user",
        content: compileLeaf("Should not appear"),
      } as any;

      const spy = vi.spyOn(console, "warn").mockReturnValue(undefined);
      const result = executePlanNode(node, ctx, budget, registry);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Unsupported PlanNode 'unknown'"));
      spy.mockRestore();

      expect(result).toHaveLength(0);
    });
  });

  describe("executePlanNodes", () => {
    it("should execute multiple nodes in sequence", () => {
      const budget = createBudget();
      const node1: CompiledPlanNode<any> = {
        kind: "message",
        role: "user",
        content: compileLeaf("First"),
      };
      const node2: CompiledPlanNode<any> = {
        kind: "message",
        role: "assistant",
        content: compileLeaf("Second"),
      };
      const nodes = [node1, node2];

      const result = executePlanNodes(nodes, ctx, budget, registry);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe("First");
      expect(result[0].role).toBe("user");
      expect(result[1].content).toBe("Second");
      expect(result[1].role).toBe("assistant");
    });

    it("should handle empty node array", () => {
      const budget = createBudget();
      const nodes: CompiledPlanNode<any>[] = [];

      const result = executePlanNodes(nodes, ctx, budget, registry);

      expect(result).toHaveLength(0);
    });
  });
});
