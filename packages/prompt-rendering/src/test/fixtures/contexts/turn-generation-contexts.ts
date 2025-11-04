import type { FakeTurnGenCtx } from "../registries/turn-generation-registry.js";

/** Enhanced turn data for comprehensive testing */
export const richTurnsDTOFixture: FakeTurnGenCtx["turns"] = [
  {
    turnNo: 1,
    authorName: "Alice",
    authorType: "character",
    content:
      "The morning sun cast long shadows across the courtyard as Alice approached the ancient fountain.",
  },
  {
    turnNo: 2,
    authorName: "Bob",
    authorType: "character",
    content: "Bob looked up from his book, startled by the sound of footsteps on the cobblestones.",
  },
  {
    turnNo: 3,
    authorName: "Narrator",
    authorType: "narrator",
    content:
      "A gentle breeze carried the scent of jasmine through the air, creating an almost magical atmosphere.",
  },
  {
    turnNo: 4,
    authorName: "Charlie",
    authorType: "character",
    content: "Charlie emerged from behind the pillar, a mysterious smile playing on their lips.",
  },
  {
    turnNo: 5,
    authorName: "Alice",
    authorType: "character",
    content:
      '"I wasn\'t expecting to find anyone else here," Alice said, her voice echoing softly in the courtyard.',
  },
  {
    turnNo: 6,
    authorName: "Bob",
    authorType: "character",
    content: "Bob closed his book carefully and stood up, brushing dust from his robes.",
  },
];

/** Rich chapter summaries for testing */
export const richChapterSummariesDTOFixture = [
  {
    chapterNo: 1,
    summary:
      "Alice and Bob first encounter each other in the Academy's great library, where they discover a shared interest in ancient magical texts.",
  },
  {
    chapterNo: 2,
    summary:
      "The mysterious stranger Charlie appears with cryptic warnings about the approaching dark season and the need to find the lost artifacts.",
  },
  {
    chapterNo: 3,
    summary:
      "Our heroes venture into the Whispering Woods, where they face their first magical challenges and learn to work as a team.",
  },
  {
    chapterNo: 4,
    summary:
      "A betrayal within their group forces Alice and Bob to question who they can trust as they near the ancient temple.",
  },
  {
    chapterNo: 5,
    summary:
      "The temple reveals its secrets, but at a cost that will change the relationship between all the characters forever.",
  },
];

const buildChapterFixtures = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    chapterNumber: index + 1,
    title: `Chapter ${index + 1}`,
    breakEventId: `chapter-break-${index + 1}`,
    breakTurnId: null,
  }));

/** Detailed character data with examples */
export const richCharactersDTOFixture = [
  {
    id: "alice",
    name: "Alice",
    description:
      "A determined young mage with auburn hair and emerald eyes. Known for her analytical mind and unwavering moral compass. She specializes in protective magic and has a natural talent for seeing through illusions.",
  },
  {
    id: "bob",
    name: "Bob",
    description:
      "A scholarly wizard who carries himself with quiet confidence. His expertise lies in ancient languages and historical magic. Bob often serves as the voice of caution and wisdom in the group.",
  },
  {
    id: "charlie",
    name: "Charlie",
    description:
      "An enigmatic figure whose past remains largely mysterious. Charlie appears to have connections to powerful magical forces and often knows more than they reveal. Their motives are unclear but seem aligned with the greater good.",
  },
  {
    id: "diana",
    name: "Diana",
    description:
      "A fierce warrior-mage who joined the group in the third chapter. Diana's combat prowess is matched only by her loyalty to her friends. She wields both sword and spell with equal skill.",
  },
  {
    id: "elena",
    name: "Elena",
    description:
      "A healer and herbalist who provides both medical and emotional support to the group. Elena's gentle nature hides a strong will and deep understanding of natural magic.",
  },
  {
    id: "felix",
    name: "Felix",
    description:
      "A young apprentice who looks up to the older members of the group. Felix's enthusiasm sometimes gets him into trouble, but his fresh perspective often provides unexpected solutions.",
  },
];

/** Standard context for most integration tests */
export const standardTurnGenCtx: FakeTurnGenCtx = {
  turns: richTurnsDTOFixture,
  chapterSummaries: richChapterSummariesDTOFixture,
  chapters: buildChapterFixtures(richChapterSummariesDTOFixture.length),
  characters: richCharactersDTOFixture,
  lorebooks: [],
  currentIntent: {
    description:
      "Continue the conversation between Alice and Bob while Charlie observes from the shadows",
    constraint: "Keep the tone mysterious but not threatening",
  },
  stepOutputs: {
    planner: {
      plan: {
        goals: ["Develop character relationships", "Advance the mystery plot"],
        beats: [
          "Alice notices something unusual",
          "Bob shares his knowledge",
          "Charlie makes their presence known",
        ],
        risks: ["Revealing too much too soon", "Breaking the atmospheric tension"],
      },
    },
    critic: {
      feedback: "The pacing is good but we need more sensory details to enhance immersion",
      suggestions: [
        "Add more environmental description",
        "Show character emotions through actions",
      ],
    },
  },
  globals: {
    worldName: "Aethermoor Academy",
    setting: "Ancient courtyard with mystical fountain",
    season: "autumn",
    weather: "crisp and clear",
  },
};

/** Large context for budget testing with many items */
export const largeTurnGenCtx: FakeTurnGenCtx = {
  turns: [
    ...richTurnsDTOFixture,
    // Add more turns for budget testing
    ...Array.from({ length: 20 }, (_, i) => ({
      turnNo: i + 7,
      authorName: i % 2 === 0 ? "Alice" : "Bob",
      authorType: "character" as const,
      content: `Turn ${i + 7}: This is additional content for budget testing. It contains enough text to consume meaningful tokens during rendering.`,
    })),
  ],
  chapterSummaries: [
    ...richChapterSummariesDTOFixture,
    ...Array.from({ length: 10 }, (_, i) => ({
      chapterNo: i + 6,
      summary: `Chapter ${i + 6}: Additional chapter summary for testing budget limits and array truncation behavior.`,
    })),
  ],
  chapters: buildChapterFixtures(richChapterSummariesDTOFixture.length + 10),
  stepOutputs: {},
  characters: richCharactersDTOFixture,
  lorebooks: [],
  currentIntent: {
    description: "Test budget limits with large context",
  },
  globals: {
    testMode: "budget_limits",
  },
};

/** Context with step chaining data for workflow testing */
export const stepChainedCtx = {
  turns: richTurnsDTOFixture.slice(0, 3), // Smaller set for focused testing
  chapterSummaries: richChapterSummariesDTOFixture.slice(0, 2),
  chapters: buildChapterFixtures(2),
  characters: richCharactersDTOFixture.slice(0, 3),
  currentIntent: {
    description: "Execute a multi-step workflow with planner -> writer chaining",
    constraint: "Follow the planner's guidance precisely",
  },
  stepOutputs: {
    planner: {
      plan: JSON.stringify({
        goals: ["Create dramatic tension", "Reveal character motivation"],
        beats: ["Alice confronts her fear", "Bob offers support", "An unexpected revelation"],
        risks: ["Moving too fast", "Losing emotional impact"],
      }),
    },
    writer: {
      draft: "Initial draft text from previous step",
      style_notes: "Focus on internal dialogue and environmental details",
    },
  },
  globals: {
    workflowMode: "step_chaining",
    currentStep: "writer",
    previousStep: "planner",
  },
};

/** Empty context for conditional testing */
export const emptyTurnGenCtx = {
  turns: [],
  chapterSummaries: [],
  chapters: [],
  characters: [],
  lorebooks: [],
  currentIntent: {
    description: "Test conditional rendering with empty arrays",
  },
  stepOutputs: {},
  globals: {
    testMode: "empty_context",
  },
};

/** Context with no turns but has summaries and characters */
export const noTurnsCtx = {
  turns: [],
  chapterSummaries: richChapterSummariesDTOFixture.slice(0, 2),
  chapters: buildChapterFixtures(2),
  characters: richCharactersDTOFixture.slice(0, 3),
  lorebooks: [],
  currentIntent: {
    description: "Test scenario where examples should render due to no current turns",
  },
  stepOutputs: {},
  globals: {
    testMode: "no_turns_with_examples",
  },
};

/** Context optimized for determinism testing */
export const deterministicTurnGenCtx: FakeTurnGenCtx = {
  turns: [
    {
      turnNo: 1,
      authorName: "Alice",
      authorType: "character",
      content: "Deterministic test content A",
    },
    {
      turnNo: 2,
      authorName: "Bob",
      authorType: "character",
      content: "Deterministic test content B",
    },
  ],
  chapterSummaries: [
    {
      chapterNo: 1,
      summary: "Deterministic chapter summary 1",
    },
    {
      chapterNo: 2,
      summary: "Deterministic chapter summary 2",
    },
  ],
  chapters: buildChapterFixtures(2),
  characters: [
    {
      id: "alice",
      name: "Alice",
      description: "Deterministic character A",
    },
    {
      id: "bob",
      name: "Bob",
      description: "Deterministic character B",
    },
  ],
  lorebooks: [],
  currentIntent: {
    description: "Deterministic test intent",
  },
  stepOutputs: {
    test: "deterministic_value",
  },
  globals: {
    mode: "determinism_test",
  },
};
