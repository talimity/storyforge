import { BaseRepository } from "./base.repository";
import { db, schema } from "../db/client";
import type { CharacterExample } from "../db/schema/character-examples";
import { eq } from "drizzle-orm";

export class CharacterExampleRepository extends BaseRepository<
  typeof schema.characterExamples
> {
  constructor() {
    super(db, schema.characterExamples);
  }

  async findByCharacterId(characterId: string): Promise<CharacterExample[]> {
    return this.db
      .select()
      .from(this.table)
      .where(eq(this.table.characterId, characterId));
  }
}

export const characterExampleRepository = new CharacterExampleRepository();
