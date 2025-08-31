import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "../../budget-manager";
import { compileTemplate } from "../../compiler";
import { render } from "../../renderer";
import {
  standardTurnGenCtx,
  stepChainedCtx,
} from "../fixtures/contexts/turn-generation-contexts";
import {
  type FakeTurnGenSourceSpec,
  makeSpecTurnGenerationRegistry,
} from "../fixtures/registries/turn-generation-registry";
import turnPlannerV1Json from "../fixtures/templates/spec/tpl_turn_planner_v1.json";
import turnWriterFromPlanV1Json from "../fixtures/templates/spec/tpl_turn_writer_from_plan_v1.json";

describe("Step Chaining via stepOutput", () => {
  const registry = makeSpecTurnGenerationRegistry();

  it("should chain planner output to writer input", () => {
    // Step 1: Render planner template
    const compiledPlanner = compileTemplate<
      "fake_turn_gen",
      FakeTurnGenSourceSpec
    >(turnPlannerV1Json);

    const plannerBudget = new DefaultBudgetManager({ maxTokens: 3000 });
    const plannerMessages = render(
      compiledPlanner,
      standardTurnGenCtx,
      plannerBudget,
      registry
    );

    // Verify planner produces assistant prefix
    const assistantMsg = plannerMessages.find(
      (m) => m.role === "assistant" && m.prefix
    );
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.content).toBe('{"goals":');

    // Step 2: Simulate LLM response completion
    // (In real usage, this would come from the LLM provider)
    const mockPlannerResponse = `{
      "goals": ["Develop character tension", "Advance the mystery"],
      "beats": ["Alice discovers a clue", "Bob expresses doubt", "Unexpected revelation"],
      "risks": ["Moving too fast", "Breaking character consistency"]
    }`;

    // Step 3: Inject plan into step inputs for writer
    const contextWithPlan = {
      ...standardTurnGenCtx,
      stepInputs: {
        ...standardTurnGenCtx.stepInputs,
        planner: {
          plan: JSON.parse(mockPlannerResponse),
        },
      },
    };

    // Step 4: Render writer template with injected plan
    const compiledWriter = compileTemplate<
      "fake_turn_gen",
      FakeTurnGenSourceSpec
    >(turnWriterFromPlanV1Json);

    const writerBudget = new DefaultBudgetManager({ maxTokens: 3000 });
    const writerMessages = render(
      compiledWriter,
      contextWithPlan,
      writerBudget,
      registry
    );

    // Step 6: Verify plan content appears in writer messages
    const planMessages = writerMessages.filter(
      (m) =>
        m.content?.includes("goals") ||
        m.content?.includes("beats") ||
        m.content?.includes("risks")
    );

    expect(planMessages.length).toBeGreaterThan(0);

    // Should contain the actual plan data
    const planContent = planMessages[0]?.content || "";
    expect(planContent).toMatch(/Develop character tension/);
    expect(planContent).toMatch(/Alice discovers a clue/);

    // Verify writer has proper structure
    expect(
      writerMessages.some((m) =>
        m.content?.includes("Player intent to respect")
      )
    ).toBe(true);
    expect(
      writerMessages.some((m) =>
        m.content?.includes("Planner guidance follows")
      )
    ).toBe(true);

    // Complete step chain snapshot
    expect(writerMessages).toMatchSnapshot("step-chaining-planner-to-writer");
  });

  it("should handle stepOutput with nested keys", () => {
    // Test the registry's ability to resolve nested step outputs
    const nestedContext = {
      ...standardTurnGenCtx,
      stepInputs: {
        planner: {
          plan: {
            summary: "Nested plan summary",
            details: {
              goals: ["Test nested access"],
              metadata: {
                version: "v1",
              },
            },
          },
        },
      },
    };

    // Test direct registry resolution
    const planSummary = registry.resolve(
      { source: "stepOutput", args: { key: "planner.plan.summary" } },
      nestedContext
    );
    const planGoals = registry.resolve(
      { source: "stepOutput", args: { key: "planner.plan.details.goals" } },
      nestedContext
    );
    const planVersion = registry.resolve(
      {
        source: "stepOutput",
        args: { key: "planner.plan.details.metadata.version" },
      },
      nestedContext
    );

    expect(planSummary).toBe("Nested plan summary");
    expect(planGoals).toEqual(["Test nested access"]);
    expect(planVersion).toBe("v1");
  });

  it("should handle missing stepOutput gracefully", () => {
    // Context without the expected step output
    const contextMissingPlan = {
      ...standardTurnGenCtx,
      stepInputs: {
        otherStep: {
          data: "some other data",
        },
      },
    };

    const compiledWriter = compileTemplate<
      "fake_turn_gen",
      FakeTurnGenSourceSpec
    >(turnWriterFromPlanV1Json);

    const budget = new DefaultBudgetManager({ maxTokens: 3000 });
    const messages = render(
      compiledWriter,
      contextMissingPlan,
      budget,
      registry
    );

    // Should render without crashing, but plan slot should be empty
    const hasPlanContent = messages.some(
      (m) => m.content?.includes("goals") || m.content?.includes("beats")
    );

    expect(hasPlanContent).toBe(false);

    // Should still have other structure
    expect(messages.some((m) => m.role === "system")).toBe(true);
    expect(messages.some((m) => m.content?.includes("Player intent"))).toBe(
      true
    );
  });

  it("should preserve step data types through chaining", () => {
    // Test with different data types in step outputs
    const typedContext = {
      ...standardTurnGenCtx,
      stepInputs: {
        analyzer: {
          score: 85,
          passed: true,
          tags: ["fantasy", "adventure"],
          metadata: {
            timestamp: "2024-01-01T10:00:00Z",
            version: 2.1,
          },
        },
      },
    };

    // Test different type resolutions
    const score = registry.resolve(
      { source: "stepOutput", args: { key: "analyzer.score" } },
      typedContext
    );
    const passed = registry.resolve(
      { source: "stepOutput", args: { key: "analyzer.passed" } },
      typedContext
    );
    const tags = registry.resolve(
      { source: "stepOutput", args: { key: "analyzer.tags" } },
      typedContext
    );
    const version = registry.resolve(
      { source: "stepOutput", args: { key: "analyzer.metadata.version" } },
      typedContext
    );

    expect(score).toBe(85);
    expect(passed).toBe(true);
    expect(tags).toEqual(["fantasy", "adventure"]);
    expect(version).toBe(2.1);

    // Test type preservation in rendering
    expect(typeof score).toBe("number");
    expect(typeof passed).toBe("boolean");
    expect(Array.isArray(tags)).toBe(true);
  });

  it("should work with pre-configured step chained context", () => {
    // Use the stepChainedCtx fixture which already has step data
    const compiledWriter = compileTemplate<
      "fake_turn_gen",
      FakeTurnGenSourceSpec
    >(turnWriterFromPlanV1Json);

    const budget = new DefaultBudgetManager({ maxTokens: 3000 });
    const messages = render(compiledWriter, stepChainedCtx, budget, registry);

    // Should resolve the pre-configured plan data
    const planMessage = messages.find(
      (m) =>
        m.content?.includes("Create dramatic tension") ||
        m.content?.includes("goals") ||
        m.content?.includes("beats")
    );

    expect(planMessage).toBeDefined();

    // Should have the structured plan content
    const planContent = planMessage?.content || "";
    expect(planContent).toMatch(/Create dramatic tension/);
    expect(planContent).toMatch(/Alice confronts her fear/);

    // Snapshot for pre-configured context
    expect(messages).toMatchSnapshot("step-chaining-preconfigured");
  });

  it("should handle complex multi-step workflows", () => {
    // Simulate a 3-step workflow: analyzer → planner → writer
    const multiStepContext = {
      ...standardTurnGenCtx,
      stepInputs: {
        analyzer: {
          sentiment: "tense",
          pacing: "moderate",
          suggestions: ["Add more dialogue", "Increase stakes"],
        },
        planner: {
          plan: JSON.stringify({
            goals: ["Build on analyzer insights"],
            beats: ["Incorporate suggested dialogue", "Raise story stakes"],
            risks: ["Overdoing the tension"],
          }),
        },
      },
    };

    // Test that stepOutput can access different step types
    const sentiment = registry.resolve(
      { source: "stepOutput", args: { key: "analyzer.sentiment" } },
      multiStepContext
    );
    const suggestions = registry.resolve(
      { source: "stepOutput", args: { key: "analyzer.suggestions" } },
      multiStepContext
    );
    const plannerOutput = registry.resolve(
      { source: "stepOutput", args: { key: "planner.plan" } },
      multiStepContext
    );

    expect(sentiment).toBe("tense");
    expect(suggestions).toEqual(["Add more dialogue", "Increase stakes"]);
    expect(typeof plannerOutput).toBe("string");
    expect(plannerOutput).toMatch(/Build on analyzer insights/);

    // Render writer with multi-step inputs
    const compiledWriter = compileTemplate<
      "fake_turn_gen",
      FakeTurnGenSourceSpec
    >(turnWriterFromPlanV1Json);

    const budget = new DefaultBudgetManager({ maxTokens: 3000 });
    const messages = render(compiledWriter, multiStepContext, budget, registry);

    // Should have content from the planner step
    const hasPlanContent = messages.some((m) =>
      m.content?.includes("Build on analyzer insights")
    );
    expect(hasPlanContent).toBe(true);
  });
});
