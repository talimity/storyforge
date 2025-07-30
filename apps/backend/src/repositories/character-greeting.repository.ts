import { BaseRepository } from "./base.repository";
import { db, schema } from "../db/client";
import type { CharacterGreeting } from "../db/schema/character-greetings";
import { eq } from "drizzle-orm";

export class CharacterGreetingRepository extends BaseRepository<
  typeof schema.characterGreetings
> {
  constructor() {
    super(db, schema.characterGreetings);
  }

  async findByCharacterId(characterId: string): Promise<CharacterGreeting[]> {
    return this.db
      .select()
      .from(this.table)
      .where(eq(this.table.characterId, characterId))
      .orderBy(this.table.isPrimary);
  }

  async findPrimaryByCharacterId(characterId: string): Promise<CharacterGreeting | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.characterId, characterId))
      .limit(1);

    return results[0];
  }
}

export const characterGreetingRepository = new CharacterGreetingRepository();
