import { and, eq } from "drizzle-orm";
import { BaseRepository } from "../../db/base.repository";
import { db, schema } from "../../db/client";
import type {
  CharacterExample,
  NewCharacterExample,
} from "../../db/schema/character-examples";
import type {
  CharacterGreeting,
  NewCharacterGreeting,
} from "../../db/schema/character-greetings";
import type { Character, NewCharacter } from "../../db/schema/characters";

export class CharacterRepository extends BaseRepository<
  typeof schema.characters
> {
  constructor() {
    super(db, schema.characters, "character");
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

  async findByIdWithRelations(id: string): Promise<
    | (Character & {
        greetings: CharacterGreeting[];
        examples: CharacterExample[];
      })
    | undefined
  > {
    const character = await this.findById(id);
    if (!character) return undefined;

    const [greetings, examples] = await Promise.all([
      this.db
        .select()
        .from(schema.characterGreetings)
        .where(eq(schema.characterGreetings.characterId, id))
        .orderBy(
          schema.characterGreetings.isPrimary,
          schema.characterGreetings.createdAt
        ),
      this.db
        .select()
        .from(schema.characterExamples)
        .where(eq(schema.characterExamples.characterId, id))
        .orderBy(schema.characterExamples.createdAt),
    ]);

    return {
      ...character,
      greetings,
      examples,
    };
  }

  async createWithRelations(
    characterData: NewCharacter,
    greetings: NewCharacterGreeting[] = [],
    examples: NewCharacterExample[] = []
  ): Promise<
    Character & { greetings: CharacterGreeting[]; examples: CharacterExample[] }
  > {
    const character = await this.create(characterData);

    const createdGreetings: CharacterGreeting[] = [];
    const createdExamples: CharacterExample[] = [];

    if (greetings.length > 0) {
      for (const greeting of greetings) {
        const created = await this.addGreeting(character.id, greeting);
        createdGreetings.push(created);
      }
    }

    if (examples.length > 0) {
      for (const example of examples) {
        const created = await this.addExample(character.id, example);
        createdExamples.push(created);
      }
    }

    return {
      ...character,
      greetings: createdGreetings,
      examples: createdExamples,
    };
  }

  override async update(
    id: string,
    data: Partial<NewCharacter>
  ): Promise<Character | undefined> {
    return super.update(id, data);
  }

  override async delete(id: string): Promise<boolean> {
    return super.delete(id);
  }

  async addGreeting(
    characterId: string,
    greeting: NewCharacterGreeting
  ): Promise<CharacterGreeting> {
    const [created] = await this.db
      .insert(schema.characterGreetings)
      .values({
        ...greeting,
        characterId,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create greeting");
    }

    return created;
  }

  async addExample(
    characterId: string,
    example: NewCharacterExample
  ): Promise<CharacterExample> {
    const [created] = await this.db
      .insert(schema.characterExamples)
      .values({
        ...example,
        characterId,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create example");
    }

    return created;
  }

  async updateGreeting(
    characterId: string,
    greetingId: string,
    data: Partial<Pick<CharacterGreeting, "message" | "isPrimary">>
  ): Promise<CharacterGreeting | undefined> {
    const [updated] = await this.db
      .update(schema.characterGreetings)
      .set(data)
      .where(
        and(
          eq(schema.characterGreetings.id, greetingId),
          eq(schema.characterGreetings.characterId, characterId)
        )
      )
      .returning();
    return updated;
  }

  async updateExample(
    characterId: string,
    exampleId: string,
    data: Partial<Pick<CharacterExample, "exampleTemplate">>
  ): Promise<CharacterExample | undefined> {
    const [updated] = await this.db
      .update(schema.characterExamples)
      .set(data)
      .where(
        and(
          eq(schema.characterExamples.id, exampleId),
          eq(schema.characterExamples.characterId, characterId)
        )
      )
      .returning();
    return updated;
  }

  async deleteGreeting(
    characterId: string,
    greetingId: string
  ): Promise<boolean> {
    const result = await this.db
      .delete(schema.characterGreetings)
      .where(
        and(
          eq(schema.characterGreetings.id, greetingId),
          eq(schema.characterGreetings.characterId, characterId)
        )
      );
    return result.changes > 0;
  }

  async deleteExample(
    characterId: string,
    exampleId: string
  ): Promise<boolean> {
    const result = await this.db
      .delete(schema.characterExamples)
      .where(
        and(
          eq(schema.characterExamples.id, exampleId),
          eq(schema.characterExamples.characterId, characterId)
        )
      );
    return result.changes > 0;
  }

  async getGreetings(characterId: string): Promise<CharacterGreeting[]> {
    return await this.db
      .select()
      .from(schema.characterGreetings)
      .where(eq(schema.characterGreetings.characterId, characterId))
      .orderBy(
        schema.characterGreetings.isPrimary,
        schema.characterGreetings.createdAt
      );
  }

  async getExamples(characterId: string): Promise<CharacterExample[]> {
    return await this.db
      .select()
      .from(schema.characterExamples)
      .where(eq(schema.characterExamples.characterId, characterId))
      .orderBy(schema.characterExamples.createdAt);
  }

  async getPrimaryGreeting(
    characterId: string
  ): Promise<CharacterGreeting | undefined> {
    const [greeting] = await this.db
      .select()
      .from(schema.characterGreetings)
      .where(
        and(
          eq(schema.characterGreetings.characterId, characterId),
          eq(schema.characterGreetings.isPrimary, true)
        )
      )
      .limit(1);
    return greeting;
  }
}

export const characterRepository = new CharacterRepository();
