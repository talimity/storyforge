import type { Character } from "@storyforge/db";
import {
  type CropResultOptions,
  cropByFocalPoint,
  detectFaceFocalPoint,
} from "@storyforge/yolo-onnx";
import { createChildLogger } from "@/logging";

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
    log.info("Detecting face in character image...");
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

export function getBufferFromDataUri(dataUri: string): Buffer {
  const base64Data = dataUri.split(",")[1];
  return Buffer.from(base64Data, "base64");
}

export async function maybeProcessCharaImage(
  avatarDataUri?: string | null
): Promise<Pick<Character, "cardFocalPoint" | "cardImage"> | undefined> {
  if (!avatarDataUri) return undefined;
  const cardImage = getBufferFromDataUri(avatarDataUri);
  return {
    cardImage,
    cardFocalPoint: await identifyCharacterFace(cardImage),
  };
}

export async function getCharaAvatarCrop(
  imageBuffer: Buffer,
  focal: { x: number; y: number; w: number; h: number },
  options: CropResultOptions = {
    outputSize: 200,
    padding: 1.2,
    allowUpscale: true,
  }
): Promise<Buffer> {
  sharp = sharp || (await import("sharp")).default;

  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Image metadata is missing width or height");
  }

  const avatar64 = await cropByFocalPoint(
    imageBuffer,
    { x: focal.x, y: focal.y, width: focal.w, height: focal.h },
    options
  );
  return sharp(avatar64).jpeg({ quality: 80 }).toBuffer();
}
