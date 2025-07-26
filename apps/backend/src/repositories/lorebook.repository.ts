import { BaseRepository } from "./base.repository";
import { db, schema } from "../db/client";
import { eq } from "drizzle-orm";
import type { Lorebook, NewLorebook } from "../db/schema/lorebooks";
import type { LorebookEntry, NewLorebookEntry } from "../db/schema/lorebooks";

export class LorebookRepository extends BaseRepository<
  typeof schema.lorebooks
> {
  constructor() {
    super(db, schema.lorebooks);
  }

  async findAllWithEntries(): Promise<
    (Lorebook & { entries: LorebookEntry[] })[]
  > {
    const lorebooks = await this.findAll();

    const entries = await this.db
      .select()
      .from(schema.lorebookEntries)
      .orderBy(schema.lorebookEntries.orderIndex);

    const entriesByLorebook = new Map<string, LorebookEntry[]>();
    for (const entry of entries) {
      if (!entriesByLorebook.has(entry.lorebookId)) {
        entriesByLorebook.set(entry.lorebookId, []);
      }
      entriesByLorebook.get(entry.lorebookId)!.push(entry);
    }

    return lorebooks.map((lorebook) => ({
      ...lorebook,
      entries: entriesByLorebook.get(lorebook.id) || [],
    }));
  }

  async findByIdWithEntries(
    id: string
  ): Promise<(Lorebook & { entries: LorebookEntry[] }) | undefined> {
    const lorebook = await this.findById(id);
    if (!lorebook) return undefined;

    const entries = await this.db
      .select()
      .from(schema.lorebookEntries)
      .where(eq(schema.lorebookEntries.lorebookId, id))
      .orderBy(schema.lorebookEntries.orderIndex);

    return {
      ...lorebook,
      entries,
    };
  }

  async createWithEntries(
    data: NewLorebook,
    entries: Omit<NewLorebookEntry, "id" | "lorebookId" | "createdAt">[]
  ): Promise<Lorebook> {
    const [lorebook] = await this.db
      .insert(this.table)
      .values(data)
      .returning();

    if (entries.length > 0 && lorebook) {
      this.transaction((tx) => {
        tx.insert(schema.lorebookEntries)
          .values(
            entries.map((entry, index) => ({
              ...entry,
              lorebookId: lorebook.id,
              orderIndex: entry.orderIndex ?? index,
            }))
          )
          .run();
      });
    }

    if (!lorebook) {
      throw new Error("Failed to create lorebook");
    }

    return lorebook;
  }

  async addEntry(
    lorebookId: string,
    entry: Omit<NewLorebookEntry, "id" | "lorebookId" | "createdAt">
  ): Promise<LorebookEntry> {
    const [newEntry] = await this.db
      .insert(schema.lorebookEntries)
      .values({
        ...entry,
        lorebookId,
      })
      .returning();

    if (!newEntry) {
      throw new Error("Failed to create lorebook entry");
    }

    return newEntry;
  }

  async updateEntry(
    entryId: string,
    data: Partial<Omit<LorebookEntry, "id" | "lorebookId" | "createdAt">>
  ): Promise<LorebookEntry | undefined> {
    const [updated] = await this.db
      .update(schema.lorebookEntries)
      .set(data)
      .where(eq(schema.lorebookEntries.id, entryId))
      .returning();

    return updated;
  }

  async deleteEntry(entryId: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.lorebookEntries)
      .where(eq(schema.lorebookEntries.id, entryId))
      .returning();

    return result.length > 0;
  }

  async findActiveEntriesByTriggers(
    triggers: string[]
  ): Promise<LorebookEntry[]> {
    const allEntries = await this.db
      .select()
      .from(schema.lorebookEntries)
      .where(eq(schema.lorebookEntries.enabled, true));

    return allEntries.filter((entry) => {
      const entryTriggers = entry.triggers as string[];
      return entryTriggers.some((trigger) =>
        triggers.some((searchTrigger) =>
          searchTrigger.toLowerCase().includes(trigger.toLowerCase())
        )
      );
    });
  }
}

export const lorebookRepository = new LorebookRepository();
