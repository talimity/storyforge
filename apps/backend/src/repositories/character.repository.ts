import { BaseRepository } from "./base.repository";
import { db, schema } from "../db/client";
import type { Character, NewCharacter } from "../db/schema/characters";

export class CharacterRepository extends BaseRepository<
  typeof schema.characters,
  Character,
  NewCharacter
> {
  constructor() {
    super(db, schema.characters);
  }

  async findByName(name: string): Promise<Character | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.name, name))
      .limit(1);

    return results[0];
  }

  async findByScenarioId(scenarioId: string): Promise<Character[]> {
    const results = await this.db
      .select({
        character: this.table,
      })
      .from(this.table)
      .innerJoin(
        schema.scenarioCharacters,
        eq(this.table.id, schema.scenarioCharacters.characterId)
      )
      .where(eq(schema.scenarioCharacters.scenarioId, scenarioId))
      .orderBy(schema.scenarioCharacters.orderIndex);

    return results.map((r) => r.character);
  }
}

import { eq } from "drizzle-orm";

export const characterRepository = new CharacterRepository();
