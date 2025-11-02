import type { SqliteDatabase, SqliteTransaction } from "@storyforge/db";

/**
 * Wraps an operation in an optional outer transaction, defaulting to the database's
 * transaction helper. Ensures we always execute in exactly one transaction.
 */
export function withTransaction<T>(
  db: SqliteDatabase,
  outerTx: SqliteTransaction | undefined,
  fn: (tx: SqliteTransaction) => Promise<T>
): Promise<T> {
  return outerTx ? fn(outerTx) : db.transaction(fn);
}
