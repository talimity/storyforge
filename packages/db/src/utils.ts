export function sqliteTimestampToDate(timestamp: string | number | Date): Date {
  if (typeof timestamp === "string") {
    return new Date(timestamp);
  } else if (typeof timestamp === "number") {
    return new Date(timestamp * 1000);
  } else {
    return timestamp;
  }
}
