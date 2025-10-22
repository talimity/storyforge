import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "../../budget-manager.js";
import { compileTemplate } from "../../compiler.js";
import { render } from "../../renderer.js";
import type { InjectionRequest, PromptTemplate } from "../../types.js";
import {
  largeTurnGenCtx,
  standardTurnGenCtx,
} from "../fixtures/contexts/turn-generation-contexts.js";
import {
  type FakeTurnGenSourceSpec,
  makeSpecTurnGenerationRegistry,
} from "../fixtures/registries/turn-generation-registry.js";

const registry = makeSpecTurnGenerationRegistry();

const template: PromptTemplate<"fake_turn_gen", FakeTurnGenSourceSpec> = {
  id: "tpl_comprehensive",
  task: "fake_turn_gen",
  name: "Comprehensive Anchor Template",
  version: 1,
  layout: [
    { kind: "message", role: "system", content: "=== Scenario Setup ===" },
    {
      kind: "slot",
      name: "timeline",
      header: { role: "system", content: "=== Recent Turns ===" },
      footer: { role: "system", content: "=== End Turns ===" },
    },
    {
      kind: "message",
      role: "system",
      content: "Instruction: Maintain mystery and reference the fountain.",
    },
    { kind: "anchor", key: "after_instructions" },
    {
      kind: "slot",
      name: "cast",
      header: { role: "system", content: "=== Cast Overview ===" },
      omitIfEmpty: false,
    },
  ],
  slots: {
    timeline: {
      priority: 0,
      plan: [
        {
          kind: "forEach",
          source: { source: "turns", args: { order: "asc", limit: 12 } },
          map: [
            {
              kind: "message",
              role: "user",
              content: "[Turn {{ item.turnNo }}] {{ item.authorName }}: {{ item.content }}",
            },
            {
              kind: "anchor",
              key: "turn_{{ item.turnNo }}",
            },
          ],
        },
      ],
      meta: {},
    },
    cast: {
      priority: 1,
      plan: [
        {
          kind: "forEach",
          source: { source: "characters", args: { order: "asc", limit: 3 } },
          map: [
            {
              kind: "message",
              role: "system",
              content: "- {{ item.name }}: {{ item.description }}",
            },
          ],
        },
      ],
      meta: {},
    },
  },
  attachments: [
    {
      id: "author_note",
      role: "system",
      order: 0,
      template: "[Author Note] {{ payload.note }}",
      reserveTokens: 64,
      budget: { maxTokens: 128 },
    },
    {
      id: "lore",
      role: "system",
      order: 1,
      template: "[Lore] {{ payload.text }}",
      reserveTokens: 160,
      budget: { maxTokens: 256 },
    },
  ],
};

const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(template);

const attachments: InjectionRequest[] = [
  {
    lane: "author_note",
    target: { kind: "boundary", position: "top", delta: 0 },
    payload: { note: "Focus on sensory detail and tension between Alice and Bob." },
  },
  {
    lane: "lore",
    target: { kind: "at", key: "turn_2", after: true },
    payload: { text: "A fountain here predates the Academy and grants visions under moonlight." },
  },
  {
    lane: "lore",
    target: { kind: "offset", key: "turn_4", delta: -1 },
    payload: { text: "The breeze carries a scent tied to ancient rituals." },
  },
  {
    lane: "lore",
    target: [
      { kind: "at", key: "turn_999" },
      { kind: "boundary", position: "bottom", delta: 0 },
    ],
    payload: { text: "Global reminder: mention the guardian spirits at least once." },
  },
];

describe("Comprehensive anchor and attachment rendering", () => {
  it("renders anchors, instructions, and attachments under generous budget", () => {
    const budget = new DefaultBudgetManager({ maxTokens: 2000 });
    const result = render(compiled, standardTurnGenCtx, budget, registry, {
      injections: attachments,
    });

    expect(result.some((msg) => msg.content.includes("[Author Note]"))).toBe(true);
    expect(result.some((msg) => msg.content.includes("[Lore]"))).toBe(true);
    expect(result[result.length - 1].content.includes("guardian spirits")).toBe(true);

    expect(result).toMatchSnapshot("comprehensive-standard");
  });

  it("preserves layout instructions and attachments with constrained budget", () => {
    const budget = new DefaultBudgetManager({ maxTokens: 320 });
    const result = render(compiled, largeTurnGenCtx, budget, registry, { injections: attachments });

    const instructionBlock = result.find((msg) => msg.content.includes("Instruction:"));
    expect(instructionBlock).toBeDefined();
    expect(result.some((msg) => msg.content.includes("[Author Note]"))).toBe(true);
    expect(result.some((msg) => msg.content.includes("[Lore]"))).toBe(true);

    expect(result).toMatchSnapshot("comprehensive-tight-budget");
  });

  it("skips injections when all targets fail", () => {
    const budget = new DefaultBudgetManager({ maxTokens: 2000 });
    const failingInjections: InjectionRequest[] = [
      {
        lane: "lore",
        target: [
          { kind: "at", key: "turn_9999" },
          { kind: "offset", key: "turn_8888", delta: 1 },
        ],
        payload: { text: "Should not appear" },
      },
    ];
    const result = render(compiled, standardTurnGenCtx, budget, registry, {
      injections: failingInjections,
    });

    expect(result.some((msg) => msg.content.includes("Should not appear"))).toBe(false);
  });
});

it("renders grouped attachments for turn events and character sections", () => {
  const template = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>({
    id: "grouped-integrated",
    task: "turn_generation",
    name: "Grouped Attachments",
    version: 1,
    layout: [
      {
        kind: "slot",
        name: "characters",
        header: { role: "system", content: "<characters>" },
        footer: { role: "system", content: "</characters>" },
      },
      {
        kind: "slot",
        name: "timeline",
        header: { role: "system", content: "<timeline>" },
        footer: { role: "system", content: "</timeline>" },
      },
    ],
    slots: {
      characters: {
        priority: 0,
        plan: [
          { kind: "anchor", key: "character_definitions_start" },
          {
            kind: "forEach",
            source: { source: "characters" },
            map: [{ kind: "message", role: "system", content: "Character: {{ item.name }}" }],
          },
          { kind: "anchor", key: "character_definitions_end" },
        ],
        meta: {},
      },
      timeline: {
        priority: 1,
        plan: [
          {
            kind: "forEach",
            source: { source: "turns" },
            map: [
              {
                kind: "message",
                role: "user",
                content: "Turn {{ item.turnNo }}: {{ item.content }}",
              },
              { kind: "anchor", key: "turn_{{ item.turnNo }}" },
            ],
          },
          { kind: "anchor", key: "timeline_start" },
          { kind: "anchor", key: "timeline_end" },
        ],
        meta: {},
      },
    },
    attachments: [
      {
        id: "lore",
        reserveTokens: 200,
        groups: [
          {
            id: "before_char",
            openTemplate: "<beforeCharacters>",
            closeTemplate: "</beforeCharacters>",
          },
          {
            id: "after_char",
            openTemplate: "<afterCharacters>",
            closeTemplate: "</afterCharacters>",
          },
          { match: "^turn_", openTemplate: "<events>", closeTemplate: "</events>" },
        ],
      },
    ],
  });

  const ctx = {
    ...standardTurnGenCtx,
    characters: standardTurnGenCtx.characters.slice(0, 2),
    turns: standardTurnGenCtx.turns.slice(0, 3).map((turn, index) => ({
      ...turn,
      turnNo: index + 1,
    })),
  };

  const budget = new DefaultBudgetManager({ maxTokens: 1000 }, (text) => text.length);
  const messages = render(template, ctx, budget, registry, {
    attachments: [
      {
        id: "lore",
        reserveTokens: 200,
        groups: [
          {
            id: "before_char",
            openTemplate: "<beforeCharacters>",
            closeTemplate: "</beforeCharacters>",
          },
          {
            id: "after_char",
            openTemplate: "<afterCharacters>",
            closeTemplate: "</afterCharacters>",
          },
          { match: "^turn_", openTemplate: "<events>", closeTemplate: "</events>" },
        ],
      },
    ],
    injections: [
      {
        lane: "lore",
        groupId: "before_char",
        target: { kind: "at", key: "character_definitions_start" },
        template: "Lore before characters",
      },
      {
        lane: "lore",
        groupId: "after_char",
        target: { kind: "at", key: "character_definitions_end", after: true },
        template: "Lore after characters",
      },
      {
        lane: "lore",
        groupId: "turn_1",
        target: { kind: "at", key: "turn_1", after: true },
        template: "Event A",
      },
      {
        lane: "lore",
        groupId: "turn_3",
        target: { kind: "at", key: "turn_3", after: true },
        template: "Event C",
      },
    ],
  });

  expect(messages).toMatchSnapshot();
});
