import { and, eq, isNull } from "drizzle-orm";
import { type StoryforgeSqliteDatabase, schema } from "../client";
import type { NewScenario, Scenario } from "../schema/scenarios";
import { BaseRepository } from "./base.repository";
import {
  type JoinedScenarioParticipant,
  ScenarioParticipantRepository,
} from "./scenario-participant.repository";

export interface ScenarioWithCharacters extends Scenario {
  characters: JoinedScenarioParticipant[];
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
    private scenarioParticipantRepo = new ScenarioParticipantRepository(
      database
    )
  ) {
    super(database, schema.scenarios, "scenario");
  }

  async findByIdWithCharacters(
    id: string,
    includeInactive?: boolean
  ): Promise<ScenarioWithCharacters | undefined> {
    const scenario = await this.findById(id);
    if (!scenario) return undefined;

    const participants =
      await this.scenarioParticipantRepo.getAssignedCharacters(
        id,
        includeInactive
      );

    return { ...scenario, characters: participants };
  }

  async findAllWithCharacters(
    includeInactive?: boolean
  ): Promise<ScenarioWithCharacters[]> {
    return this.findScenariosWithCharactersQuery(includeInactive);
  }

  async findByStatus(status: "active" | "archived"): Promise<Scenario[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.status, status))
      .orderBy(this.table.updatedAt);
  }

  async findByStatusWithCharacters(
    status: "active" | "archived",
    includeInactive?: boolean
  ): Promise<ScenarioWithCharacters[]> {
    return this.findScenariosWithCharactersQuery(includeInactive, status);
  }

  private async findScenariosWithCharactersQuery(
    includeInactive?: boolean,
    status?: "active" | "archived"
  ): Promise<ScenarioWithCharacters[]> {
    const query = this.db
      .select({
        scenario: this.table,
        participant: schema.scenarioParticipants,
        character: schema.characters,
      })
      .from(this.table)
      .leftJoin(
        schema.scenarioParticipants,
        includeInactive
          ? eq(this.table.id, schema.scenarioParticipants.scenarioId)
          : and(
              eq(this.table.id, schema.scenarioParticipants.scenarioId),
              isNull(schema.scenarioParticipants.unassignedAt)
            )
      )
      .leftJoin(
        schema.characters,
        eq(schema.scenarioParticipants.characterId, schema.characters.id)
      )
      .where(status ? eq(this.table.status, status) : undefined)
      .orderBy(this.table.updatedAt, schema.scenarioParticipants.orderIndex);

    const results = await query;

    // Group results by scenario
    const scenarioMap = new Map<string, ScenarioWithCharacters>();

    for (const row of results) {
      if (!scenarioMap.has(row.scenario.id)) {
        scenarioMap.set(row.scenario.id, {
          ...row.scenario,
          characters: [],
        });
      }

      if (row.character && row.participant) {
        const scenario = scenarioMap.get(row.scenario.id);
        if (scenario) {
          scenario.characters.push({
            ...row.participant,
            character: row.character,
            isActive: !row.participant.unassignedAt,
          });
        }
      }
    }

    return Array.from(scenarioMap.values());
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

    // TODO: make this a db constraint and do the operation in a transaction
    if (characterIds.length < 2) {
      throw new Error("A scenario must have at least 2 characters.");
    }

    // Create the scenario first
    const scenario = await super.create(scenarioData);

    // Assign characters if any are provided
    const participants: JoinedScenarioParticipant[] = [];
    for (let i = 0; i < characterIds.length; i++) {
      const characterId = characterIds[i];
      if (!characterId) {
        throw new Error(`No chara ID provided at index ${i}`);
      }
      const participant = await this.scenarioParticipantRepo.assignCharacter(
        scenario.id,
        characterId,
        { orderIndex: i }
      );
      participants.push(participant);
    }

    return { ...scenario, characters: participants };
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
