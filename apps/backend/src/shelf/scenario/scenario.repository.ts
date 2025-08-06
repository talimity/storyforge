import { eq } from "drizzle-orm";
import { BaseRepository } from "../../db/base.repository";
import { db, schema } from "../../db/client";
import type { NewScenario, Scenario } from "../../db/schema/scenarios";
import {
  type ScenarioCharacterAssignment,
  scenarioCharacterRepository,
} from "./scenario-character.repository";

export interface ScenarioWithCharacters extends Scenario {
  characters: ScenarioCharacterAssignment[];
}

export interface CreateScenarioData
  extends Omit<
    NewScenario,
    "id" | "createdAt" | "updatedAt" | "settings" | "metadata"
  > {
  characterIds?: string[];
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class ScenarioRepository extends BaseRepository<
  typeof schema.scenarios
> {
  constructor() {
    super(db, schema.scenarios, "scenario");
  }

  async findByIdWithCharacters(
    id: string,
    includeInactive?: boolean
  ): Promise<ScenarioWithCharacters | undefined> {
    const scenario = await this.findById(id);
    if (!scenario) return undefined;

    const assignments = await scenarioCharacterRepository.getAssignedCharacters(
      id,
      includeInactive
    );

    return { ...scenario, characters: assignments };
  }

  async findByStatus(status: "active" | "archived"): Promise<Scenario[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.status, status))
      .orderBy(this.table.updatedAt);
  }

  override async create(
    _data: never
  ): Promise<typeof schema.scenarios.$inferSelect> {
    throw new Error(
      "A scenario must be created with characters. Use createWithCharacters instead."
    );
  }

  async createWithCharacters(
    data: CreateScenarioData
  ): Promise<ScenarioWithCharacters> {
    const { characterIds = [], ...scenarioData } = data;

    if (!Array.isArray(characterIds) || characterIds.length === 0) {
      throw new Error("Cannot create scenario with no characters assigned.");
    }

    // Create the scenario first
    const scenario = await super.create(scenarioData);

    // Assign characters
    const assignments: ScenarioCharacterAssignment[] = [];
    for (let i = 0; i < characterIds.length; i++) {
      const characterId = characterIds[i];
      if (!characterId) {
        throw new Error(`No chara ID provided at index ${i}`);
      }
      const assignment = await scenarioCharacterRepository.assignCharacter(
        scenario.id,
        characterId,
        {
          orderIndex: i,
        }
      );
      assignments.push(assignment);
    }

    return { ...scenario, characters: assignments };
  }

  override async update(
    id: string,
    data: Partial<typeof schema.scenarios.$inferInsert>
  ): Promise<typeof schema.scenarios.$inferSelect | undefined> {
    const processedData: Record<string, unknown> = { ...data };

    if (data.settings !== undefined) {
      processedData.settings = JSON.stringify(data.settings);
    }
    if (data.metadata !== undefined) {
      processedData.metadata = JSON.stringify(data.metadata);
    }

    return super.update(id, processedData);
  }

  override async delete(id: string): Promise<boolean> {
    return super.delete(id);
  }
}

export const scenarioRepository = new ScenarioRepository();
