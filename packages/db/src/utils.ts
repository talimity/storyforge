import { getTableColumns, type InferInsertModel, sql } from "drizzle-orm";
import type {
  SQLiteTable,
  SQLiteUpdateSetSource,
} from "drizzle-orm/sqlite-core";

/** Column map type + string keys for a table */
type Columns<T extends SQLiteTable> = T["_"]["columns"];
type ColKey<T extends SQLiteTable> = Extract<keyof Columns<T>, string>;

/**
 * Build a typed update object for Drizzle.
 * - Scalars are assigned directly (null clears).
 * - JSON columns are patched atomically with json_patch(..., json(?)).
 */
export function buildSqliteUpdates<
  TTable extends SQLiteTable,
  const J extends ColKey<TTable> & keyof InferInsertModel<TTable> = never,
>(opts: {
  table: TTable;
  input: Partial<InferInsertModel<TTable>>; // use Drizzle's inferred insert/update shape
  jsonKeys: readonly J[]; // columns to merge-patch
}): SQLiteUpdateSetSource<TTable> {
  const { table, input, jsonKeys } = opts;
  const cols = getTableColumns(table);

  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(input) as [ColKey<TTable>, unknown][]) {
    if (v === undefined) continue; // omit = no change

    if ((jsonKeys as readonly string[]).includes(k)) {
      out[k] =
        v === null
          ? null // top-level clear
          : sql`json_patch(${cols[k]}, json(${JSON.stringify(v)}))`;
      continue;
    }

    out[k] = v; // scalar (or full replace for non-JSON)
  }

  return out as SQLiteUpdateSetSource<TTable>;
}

export function sqliteTimestampToDate(timestamp: string | number | Date): Date {
  if (typeof timestamp === "string") {
    return new Date(timestamp);
  } else if (typeof timestamp === "number") {
    return new Date(timestamp * 1000);
  } else {
    return timestamp;
  }
}
