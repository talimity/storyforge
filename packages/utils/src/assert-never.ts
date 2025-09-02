export function assertNever(x: never): never {
  throw new Error(`Got unexpected value: ${x}`);
}
