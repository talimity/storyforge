import { decode } from "png-chunk-text";
import pngExtract from "png-chunks-extract";
import { z } from "zod";

const CharacterBookEntrySchema = z.object({
  keys: z.array(z.string()),
  content: z.string(),
  extensions: z.record(z.string(), z.any()),
  enabled: z.boolean(),
  insertion_order: z.number(),
  case_sensitive: z.boolean().optional(),
  name: z.string().optional(),
  priority: z.number().optional(),
  id: z.number().optional(),
  comment: z.string().optional(),
  selective: z.boolean().optional(),
  secondary_keys: z.array(z.string()).optional(),
  constant: z.boolean().optional(),
  // position: z.enum(["before_char", "after_char"]).optional(), // some cards seem to have other values so the spec is fucked
  // position: z.string().optional(), // some cards seem to have a number in this field so this doesn't work either
  position: z
    .union([z.literal("before_char"), z.literal("after_char"), z.number(), z.string()])
    .optional(),
});

const CharacterBookSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  scan_depth: z.number().optional(),
  token_budget: z.number().optional(),
  recursive_scanning: z.boolean().optional(),
  extensions: z.record(z.string(), z.any()),
  entries: z.array(CharacterBookEntrySchema),
});

const TavernCardV1Schema = z.object({
  name: z.string(),
  description: z.string(),
  personality: z.string(),
  scenario: z.string(),
  first_mes: z.string(),
  mes_example: z.string(),
});
export type TavernCardV1 = z.infer<typeof TavernCardV1Schema>;

const TavernCardV2Schema = z.object({
  spec: z.literal("chara_card_v2"),
  spec_version: z.literal("2.0"),
  data: z
    .object({
      name: z.string(),
      description: z.string(),
      personality: z.string(),
      scenario: z.string(),
      first_mes: z.string(),
      mes_example: z.string(),
      creator_notes: z.string(),
      system_prompt: z.string(),
      post_history_instructions: z.string(),
      alternate_greetings: z.array(z.string()),
      character_book: CharacterBookSchema.nullish(),
      tags: z.array(z.string()),
      creator: z.string(),
      character_version: z.string(),
      extensions: z.record(z.string(), z.any()),
    })
    .transform((data) => {
      // Quirk: remove character_book if it is present, but set to undefined
      if (data.character_book === undefined) {
        const { character_book, ...rest } = data;
        return rest;
      }
      return data;
    }),
});
export type TavernCardV2 = z.infer<typeof TavernCardV2Schema>;
export type TavernCard = TavernCardV1 | TavernCardV2;

export interface ParsedCharacterCard {
  cardData: TavernCard;
  isV2: boolean;
}

export async function parseTavernCard(buffer: ArrayBufferLike): Promise<ParsedCharacterCard> {
  const chunks = pngExtract(new Uint8Array(buffer));

  const textChunk = chunks
    .filter((chunk) => chunk.name === "tEXt")
    .map((chunk) => decode(chunk.data))
    .find((decoded) => decoded.keyword === "chara");

  if (!textChunk) {
    throw new Error("No character data found in PNG file");
  }

  let cardData: TavernCard;
  let isV2 = false;

  try {
    const decodedText = Buffer.from(textChunk.text, "base64").toString("utf8");
    const rawCard = JSON.parse(decodedText);

    if (rawCard.spec === "chara_card_v2" && rawCard.spec_version === "2.0") {
      cardData = TavernCardV2Schema.parse(rawCard);
      isV2 = true;
    } else {
      cardData = TavernCardV1Schema.parse(rawCard);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid character card format: ${error.message}`);
    }
    throw new Error(
      `Failed to parse character card: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return { cardData, isV2 };
}
