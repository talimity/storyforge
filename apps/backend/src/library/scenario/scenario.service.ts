import { type NewScenario, type SqliteDatabase, schema } from "@storyforge/db";
import { eq } from "drizzle-orm";

interface CreateScenarioData extends NewScenario {
  characterIds?: string[];
}

export class ScenarioService {
  constructor(private db: SqliteDatabase) {}

  async createScenario(data: CreateScenarioData) {
    const { characterIds = [], ...scenarioData } = data;

    if (characterIds.length < 2) {
      throw new Error("A scenario must have at least 2 characters.");
    }

    return this.db.transaction(async (tx) => {
      const [sc] = await tx
        .insert(schema.scenarios)
        .values(scenarioData)
        .returning()
        .all();

      if (!sc) {
        throw new Error("Failed to create scenario");
      }

      await tx
        .insert(schema.chapters)
        .values({ scenarioId: sc.id, name: "Chapter 1", index: 0 })
        .execute();

      await tx
        .insert(schema.scenarioParticipants)
        .values(
          characterIds.map((characterId, orderIndex) => ({
            scenarioId: sc.id,
            characterId,
            orderIndex,
          }))
        )
        .execute();

      return sc;
    });
  }

  async updateScenario(id: string, data: Partial<NewScenario>) {
    const results = await this.db
      .update(schema.scenarios)
      .set(data)
      .where(eq(schema.scenarios.id, id))
      .returning();

    return results[0];
  }

  async deleteScenario(id: string) {
    const result = await this.db
      .delete(schema.scenarios)
      .where(eq(schema.scenarios.id, id))
      .returning();

    return result.length > 0;
  }
}
