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

export type CharacterContext = {
  id: string;
  name: string;
  description: string;
  type: "character" | "narrator" | "group" | "persona";
  styleInstructions?: string;
};

export type ChapterSummaryContext = {
  chapterNumber: number;
  title: string | null;
  summaryText?: string;
  summaryJson?: unknown;
  updatedAt: Date;
};
