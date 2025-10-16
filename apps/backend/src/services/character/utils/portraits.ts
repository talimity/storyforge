import type { Character } from "@storyforge/db";
import {
  type CropResultOptions,
  cropByFocalPoint,
  detectFaceFocalPoint,
} from "@storyforge/yolo-onnx";
import { createChildLogger } from "../../../logging.js";
import { DEFAULT_CHARACTER_COLOR, extractDominantColors } from "./color.js";

const log = createChildLogger("character-image-service");
let sharp: typeof import("sharp") | undefined;

const DEFAULT_FOCAL_POINT = {
  x: 0.5,
  y: 0.3,
  w: 0.5,
  h: 0.5,
  c: 0,
};

export async function identifyCharacterFace(imageBuffer: Buffer) {
  try {
    const face = await detectFaceFocalPoint(imageBuffer);
    if (face) {
      return {
        x: face.x,
        y: face.y,
        w: face.width,
        h: face.height,
        c: face.confidence,
      };
    }
  } catch (error) {
    log.error(error, "Failed to detect face in character image");
  }
  return DEFAULT_FOCAL_POINT;
}

export function bufferFromDataUri(dataUri: string): Buffer {
  const base64Data = dataUri.split(",")[1];
  return Buffer.from(base64Data, "base64");
}

export type CharacterImageUpdate =
  | { portrait: Buffer; portraitFocalPoint: Character["portraitFocalPoint"]; defaultColor: string }
  | { portrait: null; defaultColor: string };

export async function maybeProcessCharaImage(
  imageUri: string | null | undefined
): Promise<CharacterImageUpdate | undefined> {
  // no change
  if (typeof imageUri === "undefined") {
    return undefined;
  }

  // clear image
  if (imageUri === null) {
    return { portrait: null, defaultColor: DEFAULT_CHARACTER_COLOR };
  }

  // set image, derive focal point and color
  const portrait = bufferFromDataUri(imageUri);
  const portraitFocalPoint = await identifyCharacterFace(portrait);
  const dominantColors = await getColorsFromCharaImage(portrait, portraitFocalPoint);
  const defaultColor = dominantColors.at(0) || DEFAULT_CHARACTER_COLOR;

  return { portrait, portraitFocalPoint, defaultColor };
}

export async function getColorsFromCharaImage(
  imageBuffer: Buffer,
  focal: { x: number; y: number; w: number; h: number } = DEFAULT_FOCAL_POINT
) {
  sharp = sharp || (await import("sharp")).default;

  const cropped = await cropByFocalPoint(imageBuffer, focal, {
    outputSize: 128,
    padding: 1,
    allowUpscale: true,
  });
  return extractDominantColors(cropped);
}

export async function getCharaAvatarCrop(
  imageBuffer: Buffer,
  focal: { x: number; y: number; w: number; h: number } = DEFAULT_FOCAL_POINT,
  options: CropResultOptions = {
    outputSize: 200,
    padding: 1.1,
    allowUpscale: true,
  }
): Promise<Buffer> {
  sharp = sharp || (await import("sharp")).default;

  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Image metadata is missing width or height");
  }

  const avatar64 = await cropByFocalPoint(imageBuffer, focal, options);
  return sharp(avatar64).jpeg({ quality: 80 }).toBuffer();
}
