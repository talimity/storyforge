import { createCharacterSchema, focalPointSchema } from "@storyforge/contracts";
import type { z } from "zod";
import { init } from "zod-empty";

export const characterFormSchema = createCharacterSchema
  .pick({
    name: true,
    description: true,
    cardType: true,
    starters: true,
    styleInstructions: true,
    imageDataUri: true,
    defaultColor: true,
  })
  .extend({
    cardType: createCharacterSchema.shape.cardType.unwrap(),
    starters: createCharacterSchema.shape.starters.unwrap(),
    // null needed for compatibility with chara palette editor, but needs to be
    // handled properly in form submission
    portraitFocalPoint: focalPointSchema.nullish(),
    defaultColor: createCharacterSchema.shape.defaultColor.nullable(),
  });

export const characterFormDefaultValues = init(characterFormSchema);

export type CharacterFormValues = z.infer<typeof characterFormSchema>;
