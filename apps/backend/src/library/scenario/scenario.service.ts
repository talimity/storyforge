import {
  type NewScenario,
  type ScenarioParticipant,
  type SqliteDatabase,
  type SqliteTransaction,
  schema,
} from "@storyforge/db";
import { eq } from "drizzle-orm";
import { ServiceError } from "@/service-error";

interface CreateScenarioData extends NewScenario {
  characterIds?: string[];
}

export class ScenarioService {
  constructor(private db: SqliteDatabase) {}

  async createScenario(data: CreateScenarioData, outerTx?: SqliteTransaction) {
    const { characterIds = [], ...scenarioData } = data;

    if (characterIds.length < 2) {
      throw new Error("A scenario must have at least 2 characters.");
    }

    const operation = async (tx: SqliteTransaction) => {
      const [sc] = await tx
        .insert(schema.scenarios)
        .values(scenarioData)
        .returning()
        .all();

      await tx
        .insert(schema.chapters)
        .values({ scenarioId: sc.id, name: "Chapter 1", index: 0 })
        .execute();

      await tx
        .insert(schema.scenarioParticipants)
        .values({
          scenarioId: sc.id,
          characterId: null,
          type: "narrator",
          role: "Narrator",
          orderIndex: 999,
        })
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
    };

    return outerTx ? operation(outerTx) : this.db.transaction(operation);
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

  /** Adds a participant to an existing scenario. */
  async addParticipant(
    args: {
      scenarioId: string;
      characterId: ScenarioParticipant["characterId"];
      type: ScenarioParticipant["type"];
      role?: ScenarioParticipant["role"];
    },
    outerTx?: SqliteTransaction
  ) {
    const { scenarioId, characterId, type = "character", role } = args;
    const work = async (tx: SqliteTransaction) => {
      const sc = await tx
        .select()
        .from(schema.scenarios)
        .where(eq(schema.scenarios.id, scenarioId))
        .get();
      if (!sc) {
        throw new ServiceError("NotFound", {
          message: `Scenario with ID ${scenarioId} not found.`,
        });
      }

      const ps = await tx
        .select()
        .from(schema.scenarioParticipants)
        .where(eq(schema.scenarioParticipants.scenarioId, scenarioId));

      const hasNarrator = ps.some(
        (p) => p.type === "narrator" && p.characterId === null
      );
      if (type === "narrator" && hasNarrator) {
        throw new ServiceError("Conflict", {
          message: "Scenario can only have one narrator.",
        });
      }

      const maxOrderIndex = ps.reduce(
        (max, p) => Math.max(max, p.orderIndex ?? 0),
        -1
      );

      const result = await tx
        .insert(schema.scenarioParticipants)
        .values({
          scenarioId,
          characterId,
          type,
          role,
          orderIndex: type === "narrator" ? 999 : maxOrderIndex + 1,
        })
        .returning();

      return result[0];
    };
    return outerTx ? work(outerTx) : this.db.transaction(work);
  }
}
