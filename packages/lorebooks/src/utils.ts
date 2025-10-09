type ScenarioLorebookSortable = {
  sortKey: string;
  kind: "manual" | "character";
};

export function sortScenarioLorebooks<T extends ScenarioLorebookSortable>(
  values: T[] | undefined | null
): T[] {
  const items = values ?? [];
  const kindRank = (kind: ScenarioLorebookSortable["kind"]) => (kind === "manual" ? 0 : 1);

  return items.slice().sort((left, right) => {
    const kindDelta = kindRank(left.kind) - kindRank(right.kind);
    if (kindDelta !== 0) {
      return kindDelta;
    }
    return left.sortKey.localeCompare(right.sortKey);
  });
}
