/**
 * Formats a date string or Date object for display
 */
export function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString();
}

/**
 * Pluralizes a word based on a count
 */
export function pluralize(word: string, count: number, plural?: string): string {
  if (count === 1) {
    return word;
  }
  return plural || `${word}s`;
}

/**
 * Formats a count with the appropriate singular/plural form
 */
export function formatCount(count: number, singular: string, plural?: string): string {
  return `${count} ${pluralize(singular, count, plural)}`;
}
