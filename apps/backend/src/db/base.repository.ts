import { eq, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import type {
  AnySQLiteTable,
  SQLiteColumn,
  SQLiteTransaction,
} from "drizzle-orm/sqlite-core";
import type { Logger } from "pino";
import type { StoryforgeSqliteDatabase } from "@/db/client";
import { createChildLogger } from "@/logging";

type TableWithId = AnySQLiteTable & { id: SQLiteColumn };

export abstract class BaseRepository<TTable extends TableWithId> {
  protected logger: Logger;

  constructor(
    protected db: StoryforgeSqliteDatabase,
    protected table: TTable,
    loggerName: string
  ) {
    this.logger = createChildLogger(`repository:${loggerName}`);
  }

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

  async create(
    data: InferInsertModel<TTable>
  ): Promise<InferSelectModel<TTable>> {
    const results = await this.db.insert(this.table).values(data).returning();

    if (!results[0]) {
      throw new Error("Failed to create record");
    }

    return results[0] as InferSelectModel<TTable>;
  }

  async update(
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

  // biome-ignore lint/suspicious/noExplicitAny: generic type for transaction
  transaction<T>(fn: (tx: SQLiteTransaction<any, any, any, any>) => T): T {
    return this.db.transaction(fn) as T;
  }
}
