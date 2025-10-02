type CharacterAssetCandidate = {
  id: string;
  hasPortrait?: number | boolean;
  portrait?: unknown;
  updatedAt?: unknown;
};

function toCacheKey(updatedAt: unknown): string | null {
  if (updatedAt instanceof Date) {
    return updatedAt.getTime().toString(36);
  }

  if (typeof updatedAt === "number") {
    if (!Number.isFinite(updatedAt)) {
      return null;
    }
    const time = Math.trunc(updatedAt);
    return time.toString(36);
  }

  if (typeof updatedAt === "string") {
    const parsed = Date.parse(updatedAt);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return Math.trunc(parsed).toString(36);
  }

  return null;
}

function appendCacheBuster(path: string, cacheKey: string | null) {
  if (!cacheKey) {
    return path;
  }
  const separator = path.includes("?") ? "&" : "?";
  const encoded = encodeURIComponent(cacheKey);
  return `${path}${separator}cb=${encoded}`;
}

export function getCharaAssetCacheKey(character: { updatedAt?: unknown } | null): string | null {
  if (!character || typeof character.updatedAt === "undefined" || character.updatedAt === null) {
    return null;
  }
  return toCacheKey(character.updatedAt);
}

export function getCharaAssetPaths(character: CharacterAssetCandidate | null) {
  if (!character) {
    return { imagePath: null, avatarPath: null };
  }
  if (!character.hasPortrait && !character.portrait) {
    return { imagePath: null, avatarPath: null };
  }

  const cacheKey = getCharaAssetCacheKey(character);

  return {
    imagePath: appendCacheBuster(`/assets/characters/${character.id}/card`, cacheKey),
    avatarPath: appendCacheBuster(`/assets/characters/${character.id}/avatar`, cacheKey),
  };
}
