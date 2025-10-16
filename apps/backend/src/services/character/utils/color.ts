import { getColor, getPalette } from "colorthief";

export const DEFAULT_CHARACTER_COLOR = "#6b7280".toLowerCase();

function componentToHex(component: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(component)));
  return clamped.toString(16).padStart(2, "0");
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

export async function extractDominantColor(imageBuffer: Buffer): Promise<string> {
  try {
    const rgb = await getColor(imageBuffer);
    return rgbToHex(rgb).toLowerCase();
  } catch (_err) {
    // log.warn("Failed to extract dominant color for character portrait");
    return DEFAULT_CHARACTER_COLOR;
  }
}

export async function extractDominantColors(imageBuffer: Buffer): Promise<string[]> {
  try {
    const rgb = await getPalette(imageBuffer, 6, 1);
    return rgb.map((color) => rgbToHex(color).toLowerCase());
  } catch (_er) {
    // log.warn(error, "Failed to extract dominant colors for character portrait");
    return [DEFAULT_CHARACTER_COLOR];
  }
}
