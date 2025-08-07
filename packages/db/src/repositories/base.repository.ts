import { eq, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import type { AnySQLiteTable, SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { StoryforgeSqliteDatabase } from "../client";

type TableWithId = AnySQLiteTable & { id: SQLiteColumn };

export abstract class BaseRepository<TTable extends TableWithId> {
  constructor(
    protected db: StoryforgeSqliteDatabase,
    protected table: TTable,
    protected loggerName: string
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

  async exists(id: string): Promise<boolean> {
    const result = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);

    return result.length > 0;
  }

  // for mutations we want to encourage subclasses to expose their own methods,
  // so we keep these protected

  protected async create(
    data: InferInsertModel<TTable>
  ): Promise<InferSelectModel<TTable>> {
    const results = await this.db.insert(this.table).values(data).returning();

    if (!results[0]) {
      throw new Error("Failed to create record");
    }

    return results[0] as InferSelectModel<TTable>;
  }

  protected async update(
    id: string,
    data: Partial<InferInsertModel<TTable>>
  ): Promise<InferSelectModel<TTable> | undefined> {
    const results = await this.db
      .update(this.table)
      .set({ ...data })
      .where(eq(this.table.id, id))
      .returning();

    return results[0] as InferSelectModel<TTable> | undefined;
  }

  protected async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(this.table)
      .where(eq(this.table.id, id))
      .returning();

    return result.length > 0;
  }
}
