/** Sample turn data for testing */
export const sampleTurnsDTOFixture = [
  {
    turnNo: 1,
    authorName: "Alice",
    authorType: "character",
    content: "Hello there! How are you doing today?",
  },
  {
    turnNo: 2,
    authorName: "Bob",
    authorType: "character",
    content: "I'm doing well, thanks for asking. What brings you here?",
  },
  {
    turnNo: 3,
    authorName: "Narrator",
    authorType: "narrator",
    content: "The wind picks up as the conversation continues.",
  },
] satisfies Array<{
  turnNo: number;
  authorName: string;
  authorType: "character" | "narrator";
  content: string;
}>;

/** Sample chapter summaries for testing */
export const sampleChapterSummariesDTOFixture = [
  {
    chapterNo: 1,
    summary: "Alice and Bob meet for the first time at the market square.",
  },
  {
    chapterNo: 2,
    summary: "The duo encounters a mysterious stranger who offers them a quest.",
  },
];

/** Sample character data for testing */
export const sampleCharactersDTOFixture = [
  {
    id: "alice",
    name: "Alice",
    description: "A brave warrior with a heart of gold and unwavering determination.",
  },
  {
    id: "bob",
    name: "Bob",
    description: "A clever rogue with quick wit and nimble fingers.",
  },
  {
    id: "charlie",
    name: "Charlie",
    description: "A wise mage who speaks in riddles and knows ancient secrets.",
  },
];

/** Complete turn generation context for testing */
export const sampleTurnGenCtx = {
  turns: sampleTurnsDTOFixture,
  chapterSummaries: sampleChapterSummariesDTOFixture,
  characters: sampleCharactersDTOFixture,
  currentIntent: {
    description: "Continue the conversation between Alice and Bob",
    constraint: "Keep the tone light and friendly",
  },
  stepOutputs: {
    planner: {
      plan: "Alice should ask Bob about his background",
      reasoning: "This will help develop character relationships",
    },
    critic: {
      feedback: "The previous turn was too brief, add more detail",
    },
  },
  globals: {
    worldName: "Fantasyland",
    setting: "Medieval market square",
  },
};

/** Writing assistant context for testing */
export const sampleWritingAssistantCtx = {
  userText: "The quick brown fox jumps over the lazy dog.",
  examples: [
    "The agile auburn fox leaps gracefully over the sleepy canine.",
    "A swift russet fox bounds across the drowsy hound.",
  ],
  stylePrefs: {
    tone: "formal",
    verbosity: "concise",
  },
  stepOutputs: {
    analyzer: {
      suggestions: ["Use more vivid adjectives", "Vary sentence structure"],
    },
  },
  globals: {
    targetAudience: "academic",
  },
};

/** Chapter summarization context for testing */
export const sampleChapterSummCtx = {
  turns: sampleTurnsDTOFixture,
  chapterSummaries: sampleChapterSummariesDTOFixture.slice(0, 1), // Only previous chapters
  globals: {
    storyGenre: "fantasy",
    maxSummaryLength: 200,
  },
};

/** Minimal contexts for edge case testing */
export const emptyTurnGenCtx = {
  turns: [],
  chapterSummaries: [],
  characters: [],
  currentIntent: { description: "Start a new story" },
};

export const minimalTurnGenCtx = {
  turns: [sampleTurnsDTOFixture[0]],
  chapterSummaries: [],
  characters: [sampleCharactersDTOFixture[0]],
  currentIntent: { description: "Simple test" },
};
