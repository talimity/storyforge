const MIN_GAP = 0.000001;

/**
 * Given two fractional numbers as strings, this function returns an array of
 * `count` fractional numbers that are evenly spaced between them.
 */
export function fractionalStepsBetween(
  before: string,
  after: string | null,
  count: number
): string[] {
  const beforeNum = parseFloat(before);
  const afterNum = after ? parseFloat(after) : Math.ceil(beforeNum) + count + 1;

  const gap = (afterNum - beforeNum) / (count + 1);

  if (gap < MIN_GAP) {
    throw new Error(
      `Cannot find ${count} fractional steps between ${before} and ${after || "undefined"}`
    );
  }

  return Array.from({ length: count }, (_, i) =>
    String(beforeNum + gap * (i + 1))
  );
}
