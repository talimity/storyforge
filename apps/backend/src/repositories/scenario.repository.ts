import { BaseRepository } from "./base.repository";
import { db, schema } from "../db/client";
import { eq, desc } from "drizzle-orm";
import type { Scenario, NewScenario } from "../db/schema/scenarios";
import type { Turn } from "../db/schema/turns";

export class ScenarioRepository extends BaseRepository<
  typeof schema.scenarios
> {
  constructor() {
    super(db, schema.scenarios);
  }

  async findAllWithRelations(): Promise<
    (Scenario & { characterIds: string[] })[]
  > {
    const scenarios = await this.findAll();

    const scenarioCharacters = await this.db
      .select()
      .from(schema.scenarioCharacters)
      .orderBy(schema.scenarioCharacters.orderIndex);

    const scenarioCharacterMap = new Map<string, string[]>();
    for (const sc of scenarioCharacters) {
      if (!scenarioCharacterMap.has(sc.scenarioId)) {
        scenarioCharacterMap.set(sc.scenarioId, []);
      }
      scenarioCharacterMap.get(sc.scenarioId)!.push(sc.characterId);
    }

    return scenarios.map((scenario) => ({
      ...scenario,
      characterIds: scenarioCharacterMap.get(scenario.id) || [],
    }));
  }

  async findByIdWithRelations(
    id: string
  ): Promise<
    (Scenario & { characterIds: string[]; turns: Turn[] }) | undefined
  > {
    const scenario = await this.findById(id);
    if (!scenario) return undefined;

    const scenarioCharacters = await this.db
      .select()
      .from(schema.scenarioCharacters)
      .where(eq(schema.scenarioCharacters.scenarioId, id))
      .orderBy(schema.scenarioCharacters.orderIndex);

    const turns = await this.db
      .select()
      .from(schema.turns)
      .where(eq(schema.turns.scenarioId, id))
      .orderBy(schema.turns.orderIndex);

    return {
      ...scenario,
      characterIds: scenarioCharacters.map((sc) => sc.characterId),
      turns,
    };
  }

  async createWithCharacters(
    data: NewScenario,
    characterIds: string[]
  ): Promise<Scenario> {
    const [scenario] = await this.db
      .insert(this.table)
      .values(data)
      .returning();

    if (characterIds.length > 0 && scenario) {
      this.transaction((tx) => {
        tx.insert(schema.scenarioCharacters)
          .values(
            characterIds.map((characterId, index) => ({
              scenarioId: scenario.id,
              characterId,
              orderIndex: index,
            }))
          )
          .run();
      });
    }

    if (!scenario) {
      throw new Error("Failed to create scenario");
    }

    return scenario;
  }

  async updateCharacters(
    scenarioId: string,
    characterIds: string[]
  ): Promise<void> {
    this.transaction((tx) => {
      tx.delete(schema.scenarioCharacters)
        .where(eq(schema.scenarioCharacters.scenarioId, scenarioId))
        .run();

      if (characterIds.length > 0) {
        tx.insert(schema.scenarioCharacters)
          .values(
            characterIds.map((characterId, index) => ({
              scenarioId,
              characterId,
              orderIndex: index,
            }))
          )
          .run();
      }
    });
  }

  async addTurn(
    scenarioId: string,
    turn: Omit<Turn, "id" | "scenarioId" | "createdAt" | "updatedAt">
  ): Promise<Turn> {
    const lastTurn = await this.db
      .select({ orderIndex: schema.turns.orderIndex })
      .from(schema.turns)
      .where(eq(schema.turns.scenarioId, scenarioId))
      .orderBy(desc(schema.turns.orderIndex))
      .limit(1);

    const nextOrderIndex = lastTurn[0]?.orderIndex
      ? lastTurn[0].orderIndex + 1
      : 0;

    const [newTurn] = await this.db
      .insert(schema.turns)
      .values({
        ...turn,
        scenarioId,
        orderIndex: nextOrderIndex,
      })
      .returning();

    if (!newTurn) {
      throw new Error("Failed to create turn");
    }

    return newTurn;
  }
}

export const scenarioRepository = new ScenarioRepository();
