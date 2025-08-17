/**
 * Simplified lexoRank implementation.
 */

const A = "a".charCodeAt(0);
const Z = "z".charCodeAt(0);
const MIN = "a"; // effectively -∞ sentinel
const MAX = "zzzzzzzzzzzzzzzz"; // effectively +∞ for our needs
export const EMPTY_RANK = "";

export function ranksBetween(
  left: string | "", // "" means -∞
  right: string | "", // "" means +∞
  count: number
): string[] {
  if (count <= 0) return [];
  const out: string[] = [];
  let lo = left ?? "";
  for (let i = 0; i < count; i++) {
    const r = between(lo, right ?? "");
    out.push(r);
    lo = r; // thread the last produced rank as the new left bound
  }
  return out;
}

export function between(left: string | "", right: string | ""): string {
  if (!left && !right) return "m";
  if (!left) return mid("", right);
  if (!right) return mid(left, "");
  return mid(left, right);
}

export function before(right: string | ""): string {
  return between("", right);
}

export function after(left: string | ""): string {
  return between(left, "");
}

function mid(a: string, b: string): string {
  // Treat empty as -∞/∞
  if (a === "") a = MIN;
  if (b === "") b = MAX;

  if (!(a < b)) throw new Error(`No space between ranks: "${a}".."${b}"`);

  // Find first differing position (or the point where one ends)
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;

  const aCode = i < a.length ? a.charCodeAt(i) : A - 1; // pad below 'a'
  const bCode = i < b.length ? b.charCodeAt(i) : Z + 1; // pad above 'z'

  // If there’s a gap at this position, take a midpoint character
  if (aCode + 1 < bCode) {
    const c = String.fromCharCode(Math.floor((aCode + bCode) / 2));
    return a.slice(0, i) + c;
  }

  // Otherwise, extend 'a' by adding an 'm' to create space (keeps it in (a,b))
  return `${a}m`;
}
