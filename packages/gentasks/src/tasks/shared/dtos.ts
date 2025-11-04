export type TurnContext = {
  /** Internal ID of the turn. */
  turnId: string;
  /** The 1-based turn number. */
  turnNo: number;
  /** The 1-based chapter number this turn belongs to. */
  chapterNumber: number;
  /**
   * The name of the character who authored this turn, or 'Narrator' if it's a
   * narrator turn.
   */
  authorName: string;
  /** The type of the author. */
  authorType: "character" | "narrator";
  /** The content of the 'presentation' layer of the turn. */
  content: string;
  intent?: {
    /** The intent kind. */
    kind: "manual_control" | "guided_control" | "narrative_constraint" | "continue_story";
    /** If the turn was created by an Intent which has guidance text, the text. */
    text?: string;
    /**
     * A preformatted prompt string that describes the intent and any of its
     * parameters. Prompt templates can also definte their own using the
     * `intentKind` and `intentText` fields, but this field is provided for
     * convenience and as a potential default case.
     */
    prompt: string;
  };
  /** Map of other layers of the turn, keyed by layer name. */
  layers: Record<string, string>;
  /** Timeline events associated with this turn, ordered chronologically. */
  events: TimelineEventContext[];
};

export type TimelineEventContext = {
  id: string;
  kind: string;
  orderKey: string;
  payloadVersion: number;
  payload: unknown;
  prompt?: string;
};

/**
 * Derived chapter metadata exposed to narrative rendering contexts. Mirrors the chapter reducer
 * output from the timeline event system so renderers can reason about chapter boundaries without
 * querying the database.
 */
export type ChapterContext = {
  /** Sequential chapter number along the active timeline (1-based). */
  chapterNumber: number;
  /**
   * Title declared on the chapter break event that begins this chapter.
   * May be undefined when the player omitted a title.
   */
  title?: string;
  /**
   * Identifier of the chapter break event that closes the previous chapter
   * and opens this one. Useful for correlating summaries and other artifacts.
   */
  breakEventId: string;
  /**
   * Turn ID associated with the chapter break event, if the break was tied to
   * an existing turn. When null, the chapter originates from an initial-state
   * event that precedes the first turn.
   */
  breakTurnId?: string | null;
};

export type CharacterContext = {
  id: string;
  name: string;
  description: string;
  type: "character" | "narrator" | "group" | "persona";
  styleInstructions?: string;
};

export type ChapterSummaryContext = {
  chapterNumber: number;
  title?: string;
  summaryText?: string;
  updatedAt: Date;
};
