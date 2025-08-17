import { err, ok, type Result } from "@storyforge/utils";

export type TurnContentErr = "MissingPresentationLayer" | "DuplicateLayerKey";

export function validateTurnLayers(
  layers: Array<{ key: string; content: string }>
): Result<void, TurnContentErr> {
  const hasPresentation = layers.some((l) => l.key === "presentation");
  if (!hasPresentation) {
    return err("MissingPresentationLayer");
  }

  const layerKeys = new Set<string>();
  for (const layer of layers) {
    if (layerKeys.has(layer.key)) {
      return err("DuplicateLayerKey");
    }
    layerKeys.add(layer.key);
  }
  return ok(undefined);
}
