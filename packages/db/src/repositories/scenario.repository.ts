import { eq } from "drizzle-orm";
import { type StoryforgeSqliteDatabase, schema } from "../client";
import type { NewScenario, Scenario } from "../schema/scenarios";
import { BaseRepository } from "./base.repository";
import {
  type ScenarioCharacterAssignment,
  ScenarioCharacterRepository,
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
  constructor(
    database: StoryforgeSqliteDatabase,
    // TODO: this is highly questionable, repo should not depend on another; extract to service
    private scenarioCharacterRepo = new ScenarioCharacterRepository(database)
  ) {
    super(database, schema.scenarios, "scenario");
  }

  async findByIdWithCharacters(
    id: string,
    includeInactive?: boolean
  ): Promise<ScenarioWithCharacters | undefined> {
    const scenario = await this.findById(id);
    if (!scenario) return undefined;

    const assignments = await this.scenarioCharacterRepo.getAssignedCharacters(
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

    // Assign characters if any are provided
    const assignments: ScenarioCharacterAssignment[] = [];
    for (let i = 0; i < characterIds.length; i++) {
      const characterId = characterIds[i];
      if (!characterId) {
        throw new Error(`No chara ID provided at index ${i}`);
      }
      const assignment = await this.scenarioCharacterRepo.assignCharacter(
        scenario.id,
        characterId,
        { orderIndex: i }
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
      processedData.settings = data.settings;
    }
    if (data.metadata !== undefined) {
      processedData.metadata = data.metadata;
    }

    return super.update(id, processedData);
  }

  override async delete(id: string): Promise<boolean> {
    return super.delete(id);
  }
}
