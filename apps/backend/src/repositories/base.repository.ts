import { eq, InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  AnySQLiteTable,
  SQLiteColumn,
  SQLiteTransaction,
} from "drizzle-orm/sqlite-core";
import { StoryforgeSqliteDatabase } from "../db/client";

type TableWithId = AnySQLiteTable & { id: SQLiteColumn };

export abstract class BaseRepository<TTable extends TableWithId> {
  constructor(
    protected db: StoryforgeSqliteDatabase,
    protected table: TTable
  ) {}

  async findAll(): Promise<InferSelectModel<TTable>[]> {
    return this.db.select().from(this.table).all();
  }

  async findById(id: string): Promise<InferSelectModel<TTable> | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);

    return results[0];
  }

  async create(data: InferInsertModel<TTable>): Promise<InferSelectModel<TTable>> {
    const results = await this.db.insert(this.table).values(data).returning();

    if (!results[0]) {
      throw new Error("Failed to create record");
    }

    return results[0] as InferSelectModel<TTable>;
  }

  async update(id: string, data: Partial<InferInsertModel<TTable>>): Promise<InferSelectModel<TTable> | undefined> {
    const results = await this.db
      .update(this.table)
      .set({ ...data })
      .where(eq(this.table.id, id))
      .returning();

    return results[0] as InferSelectModel<TTable> | undefined;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(this.table)
      .where(eq(this.table.id, id))
      .returning();

    return result.length > 0;
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);

    return result.length > 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transaction<T>(fn: (tx: SQLiteTransaction<any, any, any, any>) => T): T {
    return this.db.transaction(fn) as T;
  }
}
