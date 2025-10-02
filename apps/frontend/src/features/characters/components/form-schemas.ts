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
  })
  .extend({
    cardType: createCharacterSchema.shape.cardType.unwrap(),
    starters: createCharacterSchema.shape.starters.unwrap(),
    portraitFocalPoint: focalPointSchema.optional(),
  });

export const characterFormDefaultValues = init(characterFormSchema);

export type CharacterFormValues = z.infer<typeof characterFormSchema>;
