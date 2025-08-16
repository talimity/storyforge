export function getCharaAssetPaths(
  character: {
    id: string;
    hasPortrait?: number | boolean;
    portrait?: unknown;
  } | null
) {
  if (!character) {
    return { imagePath: null, avatarPath: null };
  }
  if (!character.hasPortrait || !character.portrait) {
    return { imagePath: null, avatarPath: null };
  }
  return {
    imagePath: `/assets/characters/${character.id}/image.png`,
    avatarPath: `/assets/characters/${character.id}/avatar.png`,
  };
}
