import { getDbClient, schema } from "@storyforge/db";
import { eq } from "drizzle-orm";
import { logger } from "../logging.js";
import {
  DEFAULT_CHARACTER_COLOR,
  extractDominantColor,
} from "../services/character/utils/color.js";
import { getCharaAvatarCrop } from "../services/character/utils/portraits.js";

async function resetCharacterColors() {
  const db = await getDbClient();

  const characters = await db
    .select({
      id: schema.characters.id,
      name: schema.characters.name,
      portrait: schema.characters.portrait,
      focalPoint: schema.characters.portraitFocalPoint,
      defaultColor: schema.characters.defaultColor,
    })
    .from(schema.characters);

  let updatedCount = 0;
  let skippedWithoutPortrait = 0;

  for (const character of characters) {
    const { id, portrait, defaultColor } = character;

    if (!portrait) {
      skippedWithoutPortrait += 1;
      continue;
    }

    console.log(`Processing character "${character.name}" (${id})`);

    const cropped = await getCharaAvatarCrop(portrait, character.focalPoint, {
      allowUpscale: true,
      maxSize: 128,
      padding: 1,
    });

    const derived = await extractDominantColor(cropped);
    const nextColor = (derived ?? DEFAULT_CHARACTER_COLOR).toLowerCase();

    if (nextColor === defaultColor.toLowerCase()) {
      continue;
    }

    await db
      .update(schema.characters)
      .set({ defaultColor: nextColor })
      .where(eq(schema.characters.id, id));

    updatedCount += 1;
  }

  logger.info({ updatedCount, skippedWithoutPortrait }, "Reset character colors complete");
}

resetCharacterColors().catch((error) => {
  logger.error(error, "Failed to reset character colors");
  process.exitCode = 1;
});
