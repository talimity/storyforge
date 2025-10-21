import { describe, expect, it } from "vitest";
import { compileTemplate } from "../../compiler.js";
import { render } from "../../renderer.js";
import type { BudgetManager, PromptTemplate } from "../../types.js";
import { standardTurnGenCtx } from "../fixtures/contexts/turn-generation-contexts.js";
import { makeSpecTurnGenerationRegistry } from "../fixtures/registries/turn-generation-registry.js";

const registry = makeSpecTurnGenerationRegistry();

const budget: BudgetManager = {
  hasAny: () => true,
  canFitTokenEstimate: () => true,
  consume: () => {},
  withNodeBudget: (_b, thunk) => thunk(),
  estimateTokens: () => 0,
  reserveFloor: () => {},
  releaseFloor: () => {},
  withLane: (_lane, thunk) => thunk(),
};

describe("reserved sources inside forEach", () => {
  it("allows conditions and from to see loop item", () => {
    const template: PromptTemplate<"turn_generation", any> = {
      id: "tpl_reserved_sources",
      task: "turn_generation",
      name: "Reserved Sources Test",
      version: 1,
      layout: [{ kind: "slot", name: "chars", omitIfEmpty: false }],
      slots: {
        chars: {
          priority: 0,
          plan: [
            {
              kind: "forEach",
              source: { source: "characters", args: { order: "asc", limit: 3 } },
              map: [
                {
                  kind: "if",
                  when: {
                    type: "neq",
                    ref: { source: "$item", args: { path: "name" } },
                    value: "Alice",
                  },
                  then: [
                    {
                      kind: "message",
                      role: "user",
                      from: { source: "$item", args: { path: "name" } },
                    },
                  ],
                },
              ],
            },
          ],
          meta: {},
        },
      },
    };

    const compiled = compileTemplate(template, { allowedSources: registry.list?.() });
    const messages = render(compiled, standardTurnGenCtx, budget, registry);

    expect(messages.length).toBeGreaterThanOrEqual(1);
    const text = messages.map((m) => m.content).join("\n");
    expect(text).not.toContain("Alice");
    expect(text).toContain("Bob");
    expect(text).toContain("Charlie");
  });
});
