import { eq, InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  SQLiteTable,
  SQLiteTableWithColumns,
  SQLiteTransaction,
} from "drizzle-orm/sqlite-core";
import { StoryforgeSqliteDatabase } from "../db/client";

export abstract class BaseRepository<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TTable extends SQLiteTable,
  TSelect = InferSelectModel<TTable>,
  TInsert = InferInsertModel<TTable>,
> {
  constructor(
    protected db: StoryforgeSqliteDatabase,
    protected table: TTable
  ) {}

  async findAll(): Promise<TSelect[]> {
    return this.db.select().from(this.table).all();
  }

  async findById(id: string): Promise<TSelect | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);

    return results[0];
  }

  async create(data: TInsert): Promise<TSelect> {
    const results = await this.db.insert(this.table).values(data).returning();

    return results[0];
  }

  async update(
    id: string,
    data: Partial<TInsert>
  ): Promise<TSelect | undefined> {
    const results = await this.db
      .update(this.table)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(this.table.id, id))
      .returning();

    return results[0];
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

  transaction<T>(fn: (tx: SQLiteTransaction<any, any, any, any>) => T): T {
    return this.db.transaction(fn) as T;
  }
}
