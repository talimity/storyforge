import { eq } from "drizzle-orm";
import type {
  SQLiteTableWithColumns,
  SQLiteTransaction,
  TableConfig,
} from "drizzle-orm/sqlite-core";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export abstract class BaseRepository<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TTable extends SQLiteTableWithColumns<any>,
  TSelect = TTable["$inferSelect"],
  TInsert = TTable["$inferInsert"],
> {
  constructor(
    protected db: BetterSQLite3Database,
    protected table: TTable
  ) {}

  async findAll(): Promise<TSelect[]> {
    return this.db.select().from(this.table).all() as TSelect[];
  }

  async findById(id: string): Promise<TSelect | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq((this.table as any).id, id))
      .limit(1);

    return results[0] as TSelect | undefined;
  }

  async create(data: TInsert): Promise<TSelect> {
    const results = await this.db.insert(this.table).values(data).returning();

    return results[0] as TSelect;
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
      .where(eq((this.table as any).id, id))
      .returning();

    return results[0] as TSelect | undefined;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(this.table)
      .where(eq((this.table as any).id, id))
      .returning();

    return result.length > 0;
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.db
      .select({ id: (this.table as any).id })
      .from(this.table)
      .where(eq((this.table as any).id, id))
      .limit(1);

    return result.length > 0;
  }

  transaction<T>(fn: (tx: SQLiteTransaction<any, any, any, any>) => T): T {
    return this.db.transaction(fn) as T;
  }
}
